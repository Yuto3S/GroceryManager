import { describe, expect, it } from "@jest/globals";
import type { CatalogueEntry, Location, PantryEntry } from "../../types";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  buildBackup,
  parseBackup,
  repairBackup,
} from "../backup";

const AT = new Date(2026, 7, 23, 14, 5).getTime();

const location = (over: Partial<Location> = {}): Location => ({
  id: "loc-fridge",
  name: "Fridge",
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
  ...over,
});

const catalogueEntry = (
  over: Partial<CatalogueEntry> = {},
): CatalogueEntry => ({
  id: "cat-1",
  key: "barcode:3017620422003",
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Ferrero",
  imageUrl: "https://images.example/nutella.jpg",
  nutriScore: "E",
  category: "Spreads",
  quantityText: "400 g",
  needsName: false,
  defaultUnit: "g",
  countStep: 1,
  measureStep: 100,
  measureUnit: "g",
  defaultLocationId: "loc-fridge",
  useCount: 3,
  shelfLifeDays: null,
  createdAt: 1000,
  updatedAt: 2000,
  deletedAt: null,
  ...over,
});

const entry = (over: Partial<PantryEntry> = {}): PantryEntry => ({
  id: "entry-1",
  productKey: "barcode:3017620422003",
  amount: 400,
  unit: "g",
  step: 100,
  locationId: "loc-fridge",
  expiresAt: null,
  createdAt: 1500,
  updatedAt: 2500,
  deletedAt: null,
  ...over,
});

const contents = (over: Partial<Parameters<typeof buildBackup>[0]> = {}) => ({
  entries: { "entry-1": entry() },
  catalogue: { "barcode:3017620422003": catalogueEntry() },
  locations: { "loc-fridge": location() },
  ...over,
});

const seed = (): Location[] => [
  location({ id: "seed-fridge", name: "Fridge", createdAt: 1 }),
  location({ id: "seed-cupboard", name: "Cupboard", createdAt: 2 }),
];

/** Parse a document, asserting it was accepted, so tests read straight through. */
function accept(text: string) {
  const result = parseBackup(text);
  if (!result.ok) {
    throw new Error(`expected a valid backup, got ${result.reason.kind}`);
  }
  return result;
}

describe("buildBackup", () => {
  it("carries the format marker, version and timestamp", () => {
    const backup = buildBackup(contents(), AT);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe(AT);
  });

  it("includes everything the user entered", () => {
    const backup = buildBackup(contents(), AT);
    expect(Object.keys(backup.entries)).toEqual(["entry-1"]);
    expect(Object.keys(backup.catalogue)).toEqual(["barcode:3017620422003"]);
    expect(Object.keys(backup.locations)).toEqual(["loc-fridge"]);
  });

  it("keeps tombstoned entries and locations", () => {
    const backup = buildBackup(
      contents({
        entries: { "entry-1": entry({ deletedAt: 3000 }) },
        locations: { "loc-fridge": location({ deletedAt: 3000 }) },
      }),
      AT,
    );
    expect(backup.entries["entry-1"]?.deletedAt).toBe(3000);
    expect(backup.locations["loc-fridge"]?.deletedAt).toBe(3000);
  });

  it("has no place for the product cache or a scan session", () => {
    const backup = buildBackup(contents(), AT);
    const keys = Object.keys(backup);
    expect(keys).not.toContain("productCache");
    expect(keys).not.toContain("session");
    expect(keys.sort()).toEqual([
      "catalogue",
      "entries",
      "exportedAt",
      "format",
      "locations",
      "version",
    ]);
  });
});

describe("backupFilename", () => {
  it("names the file after the local date and time", () => {
    expect(backupFilename(AT)).toBe("pantry-backup-2026-08-23-1405.json");
  });

  it("distinguishes backups taken on different days", () => {
    const other = new Date(2026, 7, 24, 14, 5).getTime();
    expect(backupFilename(AT)).not.toBe(backupFilename(other));
  });
});

describe("parseBackup — structural rejection", () => {
  it("rejects text that is not JSON", () => {
    const result = parseBackup("not json at all");
    expect(result).toEqual({ ok: false, reason: { kind: "not-json" } });
  });

  it("rejects a truncated document", () => {
    const text = JSON.stringify(buildBackup(contents(), AT));
    const result = parseBackup(text.slice(0, text.length - 20));
    expect(result).toEqual({ ok: false, reason: { kind: "not-json" } });
  });

  it("rejects a JSON array", () => {
    const result = parseBackup("[1, 2, 3]");
    expect(result).toEqual({ ok: false, reason: { kind: "not-a-backup" } });
  });

  it("rejects JSON that is not a backup, even with an entries key", () => {
    const result = parseBackup(JSON.stringify({ entries: {}, version: 1 }));
    expect(result).toEqual({ ok: false, reason: { kind: "not-a-backup" } });
  });

  it("rejects a document with no version", () => {
    const result = parseBackup(JSON.stringify({ format: BACKUP_FORMAT }));
    expect(result).toEqual({ ok: false, reason: { kind: "not-a-backup" } });
  });

  it("rejects a document with no export timestamp", () => {
    const result = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 1 }),
    );
    expect(result).toEqual({ ok: false, reason: { kind: "not-a-backup" } });
  });

  it("refuses a backup from a newer format version, naming it", () => {
    const backup = { ...buildBackup(contents(), AT), version: 99 };
    const result = parseBackup(JSON.stringify(backup));
    expect(result).toEqual({
      ok: false,
      reason: {
        kind: "future-version",
        version: 99,
        supported: BACKUP_VERSION,
      },
    });
  });

  it("produces nothing at all when a document is rejected", () => {
    const result = parseBackup("{}");
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("backup");
  });
});

describe("parseBackup — per-record validation", () => {
  /** A backup whose single entry has been tampered with. */
  const withBadEntry = (over: Record<string, unknown>) =>
    JSON.stringify({
      ...buildBackup(contents(), AT),
      entries: { "entry-1": { ...entry(), ...over } },
    });

  it("drops an entry with no id", () => {
    const result = accept(withBadEntry({ id: undefined }));
    expect(result.backup.entries).toEqual({});
    expect(result.droppedMalformed).toBe(1);
  });

  it("drops an entry whose amount is not a number", () => {
    const result = accept(withBadEntry({ amount: "loads" }));
    expect(result.backup.entries).toEqual({});
    expect(result.droppedMalformed).toBe(1);
  });

  it("drops an entry whose unit is not one we know", () => {
    const result = accept(withBadEntry({ unit: "kg" }));
    expect(result.backup.entries).toEqual({});
    expect(result.droppedMalformed).toBe(1);
  });

  it("drops an entry with no product key", () => {
    const result = accept(withBadEntry({ productKey: "" }));
    expect(result.backup.entries).toEqual({});
  });

  it("keeps an entry but clears an expiry that is not a calendar date", () => {
    const result = accept(withBadEntry({ expiresAt: "27 August 2026" }));
    expect(result.backup.entries["entry-1"]?.expiresAt).toBeNull();
    expect(result.droppedMalformed).toBe(0);
    expect(result.clearedExpiry).toBe(1);
  });

  it("keeps a well-formed calendar date untouched", () => {
    const result = accept(withBadEntry({ expiresAt: "2026-08-27" }));
    expect(result.backup.entries["entry-1"]?.expiresAt).toBe("2026-08-27");
    expect(result.clearedExpiry).toBe(0);
  });

  it("does not count a null expiry as cleared", () => {
    const result = accept(withBadEntry({ expiresAt: null }));
    expect(result.clearedExpiry).toBe(0);
  });

  it("drops one bad record without discarding the rest of the file", () => {
    const text = JSON.stringify({
      ...buildBackup(contents(), AT),
      entries: {
        good: entry({ id: "good" }),
        bad: { ...entry({ id: "bad" }), amount: null },
      },
    });
    const result = accept(text);
    expect(Object.keys(result.backup.entries)).toEqual(["good"]);
    expect(result.droppedMalformed).toBe(1);
  });

  it("drops a location with no name", () => {
    const text = JSON.stringify({
      ...buildBackup(contents(), AT),
      locations: { "loc-fridge": { ...location(), name: "" } },
    });
    expect(accept(text).backup.locations).toEqual({});
  });

  it("drops a catalogue record with no key", () => {
    const text = JSON.stringify({
      ...buildBackup(contents(), AT),
      catalogue: { x: { ...catalogueEntry(), key: undefined } },
    });
    expect(accept(text).backup.catalogue).toEqual({});
  });

  it("refuses to carry a non-https image url through", () => {
    const text = JSON.stringify({
      ...buildBackup(contents(), AT),
      catalogue: {
        "barcode:3017620422003": {
          ...catalogueEntry(),
          imageUrl: "javascript:alert(1)",
        },
      },
    });
    const record = accept(text).backup.catalogue["barcode:3017620422003"];
    expect(record?.imageUrl).toBeNull();
  });

  it("falls back rather than dropping a catalogue record with a bad step", () => {
    const text = JSON.stringify({
      ...buildBackup(contents(), AT),
      catalogue: {
        "barcode:3017620422003": {
          ...catalogueEntry(),
          countStep: -4,
          measureStep: "lots",
        },
      },
    });
    const record = accept(text).backup.catalogue["barcode:3017620422003"];
    expect(record?.countStep).toBe(1);
    expect(record?.measureStep).toBe(100);
  });

  it("ignores a slice that is not an object", () => {
    const text = JSON.stringify({
      ...buildBackup(contents(), AT),
      entries: "gone",
    });
    expect(accept(text).backup.entries).toEqual({});
  });
});

describe("repairBackup", () => {
  it("reports a clean import with nothing dropped or repaired", () => {
    const parsed = accept(JSON.stringify(buildBackup(contents(), AT)));
    const { report } = repairBackup(parsed, seed());
    expect(report).toEqual({
      entries: 1,
      catalogue: 1,
      locations: 1,
      droppedMalformed: 0,
      droppedMissingProduct: 0,
      droppedNoLocation: 0,
      clearedExpiry: 0,
      reassignedLocation: 0,
      seededLocations: false,
    });
  });

  it("reassigns an entry whose location is absent, and says so", () => {
    const parsed = accept(
      JSON.stringify(
        buildBackup(
          contents({ entries: { "entry-1": entry({ locationId: "gone" }) } }),
          AT,
        ),
      ),
    );
    const { contents: repaired, report } = repairBackup(parsed, seed());
    expect(repaired.entries["entry-1"]?.locationId).toBe("loc-fridge");
    expect(report.reassignedLocation).toBe(1);
    expect(report.entries).toBe(1);
  });

  it("drops an entry whose catalogue record is absent, and says so", () => {
    const parsed = accept(
      JSON.stringify(buildBackup(contents({ catalogue: {} }), AT)),
    );
    const { contents: repaired, report } = repairBackup(parsed, seed());
    expect(repaired.entries).toEqual({});
    expect(report.droppedMissingProduct).toBe(1);
    expect(report.entries).toBe(0);
  });

  it("seeds locations when the backup has none, and lands entries there", () => {
    const parsed = accept(
      JSON.stringify(buildBackup(contents({ locations: {} }), AT)),
    );
    const { contents: repaired, report } = repairBackup(parsed, seed());
    expect(report.seededLocations).toBe(true);
    expect(Object.keys(repaired.locations).sort()).toEqual([
      "seed-cupboard",
      "seed-fridge",
    ]);
    expect(repaired.entries["entry-1"]?.locationId).toBe("seed-fridge");
    expect(report.reassignedLocation).toBe(1);
  });

  it("seeds when every location in the backup is a tombstone", () => {
    const parsed = accept(
      JSON.stringify(
        buildBackup(
          contents({
            locations: { "loc-fridge": location({ deletedAt: 9000 }) },
          }),
          AT,
        ),
      ),
    );
    expect(repairBackup(parsed, seed()).report.seededLocations).toBe(true);
  });

  it("reassigns to the oldest live location", () => {
    const parsed = accept(
      JSON.stringify(
        buildBackup(
          contents({
            entries: { "entry-1": entry({ locationId: "gone" }) },
            locations: {
              newer: location({ id: "newer", createdAt: 5000 }),
              older: location({ id: "older", createdAt: 100 }),
            },
          }),
          AT,
        ),
      ),
    );
    const { contents: repaired } = repairBackup(parsed, seed());
    expect(repaired.entries["entry-1"]?.locationId).toBe("older");
  });

  it("carries malformed-record drops through to the report", () => {
    const parsed = accept(
      JSON.stringify({
        ...buildBackup(contents(), AT),
        entries: {
          good: entry({ id: "good" }),
          bad: { ...entry({ id: "bad" }), unit: "kg" },
        },
      }),
    );
    expect(repairBackup(parsed, seed()).report.droppedMalformed).toBe(1);
  });

  it("keeps a tombstoned entry rather than treating it as a repair", () => {
    const parsed = accept(
      JSON.stringify(
        buildBackup(
          contents({ entries: { "entry-1": entry({ deletedAt: 4000 }) } }),
          AT,
        ),
      ),
    );
    const { contents: repaired, report } = repairBackup(parsed, seed());
    expect(repaired.entries["entry-1"]?.deletedAt).toBe(4000);
    expect(report.reassignedLocation).toBe(0);
  });
});

describe("round trip", () => {
  it("reproduces the pantry exactly, identities and timestamps included", () => {
    const original = contents({
      entries: {
        a: entry({ id: "a", expiresAt: "2026-09-01" }),
        b: entry({ id: "b", createdAt: 7, updatedAt: 8, deletedAt: 9 }),
      },
    });
    const text = JSON.stringify(buildBackup(original, AT));
    const { contents: restored } = repairBackup(accept(text), seed());
    expect(restored).toEqual(original);
  });

  it("does not resurrect removed records", () => {
    const original = contents({
      entries: { a: entry({ id: "a", deletedAt: 4000 }) },
      locations: { "loc-fridge": location({ deletedAt: 4000 }) },
    });
    const text = JSON.stringify(buildBackup(original, AT));
    const { contents: restored } = repairBackup(accept(text), seed());
    expect(restored.entries.a?.deletedAt).toBe(4000);
    // Every location was a tombstone, so seeding ran and the entry moved — but
    // the entry itself is still removed.
    expect(restored.entries.a?.deletedAt).not.toBeNull();
  });
});
