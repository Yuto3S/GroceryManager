import { describe, expect, it } from "@jest/globals";
import {
  type BackupContents,
  buildBackup,
  parseBackup,
  repairBackup,
} from "../../lib/backup";
import { isOutOfStock, isVisible } from "../../lib/pantry";
import type { Location } from "../../types";
import {
  type Action,
  type AddProductInput,
  initialState,
  type PantryState,
  pantryReducer,
} from "../pantryReducer";

const NOW = new Date(2026, 7, 22, 12, 0).getTime();
const YESTERDAY = new Date(2026, 7, 21, 12, 0).getTime();
const MONTHS_AGO = new Date(2026, 2, 2, 12, 0).getTime();

const location = (id: string, name: string): Location => ({
  id,
  name,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
});

const FRIDGE = location("loc-fridge", "Fridge");
const FREEZER = location("loc-freezer", "Freezer");
const CUPBOARD = location("loc-cupboard", "Cupboard");
const SEED = [FRIDGE, FREEZER, CUPBOARD];

const product = (over: Partial<AddProductInput> = {}): AddProductInput => ({
  key: "barcode:3017620422003",
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Ferrero",
  imageUrl: null,
  nutriScore: "E",
  category: "Hazelnut spreads",
  quantityText: "400 g",
  needsName: false,
  shelfLifeDays: null,
  ...over,
});

const add = (over: Partial<Extract<Action, { type: "ADD_PRODUCT" }>> = {}) =>
  ({
    type: "ADD_PRODUCT",
    now: NOW,
    entryId: "entry-1",
    product: product(),
    amount: 1,
    unit: "piece",
    step: 1,
    measureUnit: "g",
    locationId: FRIDGE.id,
    ...over,
  }) satisfies Action;

/** A hydrated, empty pantry with the three seeded locations. */
function hydrated(): PantryState {
  return pantryReducer(initialState, {
    type: "HYDRATE",
    entries: null,
    catalogue: null,
    locations: null,
    productCache: null,
    seedLocations: SEED,
  });
}

const entriesOf = (state: PantryState) => Object.values(state.entries);
const visibleOf = (state: PantryState) => entriesOf(state).filter(isVisible);

describe("HYDRATE", () => {
  it("seeds the three locations on first run", () => {
    const state = hydrated();
    expect(state.loaded).toBe(true);
    expect(Object.values(state.locations).map((l) => l.name)).toEqual([
      "Fridge",
      "Freezer",
      "Cupboard",
    ]);
  });

  it("does not re-seed over persisted locations", () => {
    const state = pantryReducer(initialState, {
      type: "HYDRATE",
      entries: null,
      catalogue: null,
      locations: { [CUPBOARD.id]: CUPBOARD },
      productCache: null,
      seedLocations: SEED,
    });
    expect(Object.keys(state.locations)).toEqual([CUPBOARD.id]);
  });

  it("re-seeds when every persisted location was removed", () => {
    const state = pantryReducer(initialState, {
      type: "HYDRATE",
      entries: null,
      catalogue: null,
      locations: { [CUPBOARD.id]: { ...CUPBOARD, deletedAt: NOW } },
      productCache: null,
      seedLocations: SEED,
    });
    expect(Object.keys(state.locations)).toHaveLength(3);
  });

  describe("malformed persisted data", () => {
    // Whatever is on the device: an older build's shape, a partial write, a
    // file someone edited. None of it may stop the app from launching.
    const junk: [string, unknown][] = [
      ["null", null],
      ["an array", []],
      ["a string", "nope"],
      ["a number", 7],
      ["a boolean", true],
      ["an object of non-objects", { a: 1, b: "x", c: null }],
    ];

    it.each(junk)("survives entries being %s", (_label, entries) => {
      const state = pantryReducer(initialState, {
        type: "HYDRATE",
        entries: entries as never,
        catalogue: entries as never,
        locations: entries as never,
        productCache: entries as never,
        seedLocations: SEED,
      });
      expect(state.loaded).toBe(true);
      expect(entriesOf(state)).toEqual([]);
      expect(Object.keys(state.locations)).toHaveLength(3);
    });
  });
});

describe("ADD_PRODUCT", () => {
  it("creates an entry and a catalogue record", () => {
    const state = pantryReducer(hydrated(), add());

    expect(visibleOf(state)).toHaveLength(1);
    expect(visibleOf(state)[0]).toMatchObject({
      id: "entry-1",
      productKey: "barcode:3017620422003",
      amount: 1,
      unit: "piece",
      locationId: FRIDGE.id,
      deletedAt: null,
    });
    expect(state.catalogue["barcode:3017620422003"]).toMatchObject({
      name: "Nutella",
      useCount: 1,
    });
  });

  it("reserves the expiry slot but never fills it in this change", () => {
    const state = pantryReducer(hydrated(), add());
    expect(visibleOf(state)[0]?.expiresAt).toBeNull();
  });

  it("counts every add, merged or not", () => {
    let state = pantryReducer(hydrated(), add());
    state = pantryReducer(state, add({ entryId: "entry-2" }));
    expect(state.catalogue["barcode:3017620422003"]?.useCount).toBe(2);
  });

  describe("merging", () => {
    it("merges a second add on the same day into one entry", () => {
      let state = pantryReducer(hydrated(), add({ amount: 2 }));
      state = pantryReducer(state, add({ entryId: "entry-2", amount: 4 }));

      expect(visibleOf(state)).toHaveLength(1);
      expect(visibleOf(state)[0]?.amount).toBe(6);
    });

    it("revives a hidden out-of-stock entry rather than creating a new one", () => {
      let state = pantryReducer(hydrated(), add({ amount: 1 }));
      state = pantryReducer(state, {
        type: "CONSUME_ENTRY",
        id: "entry-1",
        now: NOW,
      });
      expect(visibleOf(state)).toHaveLength(0);

      state = pantryReducer(state, add({ entryId: "entry-2", amount: 3 }));
      expect(entriesOf(state)).toHaveLength(1);
      expect(visibleOf(state)[0]).toMatchObject({ id: "entry-1", amount: 3 });
    });

    it("does not merge into a tombstoned entry", () => {
      let state = pantryReducer(hydrated(), add());
      state = pantryReducer(state, {
        type: "REMOVE_ENTRY",
        id: "entry-1",
        now: NOW,
      });
      state = pantryReducer(state, add({ entryId: "entry-2" }));

      expect(entriesOf(state)).toHaveLength(2);
      expect(visibleOf(state).map((e) => e.id)).toEqual(["entry-2"]);
    });

    it("does not merge across units, which would need a conversion", () => {
      let state = pantryReducer(hydrated(), add({ unit: "piece", amount: 2 }));
      state = pantryReducer(
        state,
        add({ entryId: "entry-2", unit: "g", amount: 500, step: 100 }),
      );

      expect(visibleOf(state)).toHaveLength(2);
    });

    it("keeps separate rows for a dated product added on different days", () => {
      // Reachable once shelf lives exist; until then clause 3 merges these.
      let state = pantryReducer(
        hydrated(),
        add({ now: YESTERDAY, product: product({ shelfLifeDays: 7 }) }),
      );
      state = {
        ...state,
        entries: Object.fromEntries(
          entriesOf(state).map((e) => [
            e.id,
            { ...e, expiresAt: "2026-08-26" },
          ]),
        ),
      };
      state = pantryReducer(
        state,
        add({ entryId: "entry-2", product: product({ shelfLifeDays: 7 }) }),
      );

      expect(visibleOf(state)).toHaveLength(2);
    });

    it("merges a long-life product added months apart", () => {
      let state = pantryReducer(
        hydrated(),
        add({ now: MONTHS_AGO, product: product({ shelfLifeDays: 730 }) }),
      );
      state = {
        ...state,
        entries: Object.fromEntries(
          entriesOf(state).map((e) => [
            e.id,
            { ...e, expiresAt: "2028-01-01" },
          ]),
        ),
      };
      state = pantryReducer(
        state,
        add({ entryId: "entry-2", product: product({ shelfLifeDays: 730 }) }),
      );

      expect(visibleOf(state)).toHaveLength(1);
      expect(visibleOf(state)[0]?.amount).toBe(2);
    });
  });

  describe("catalogue defaults", () => {
    it("remembers the measure step without losing the count step", () => {
      let state = pantryReducer(
        hydrated(),
        add({ unit: "g", amount: 500, step: 125 }),
      );
      let record = state.catalogue["barcode:3017620422003"];
      expect(record).toMatchObject({
        defaultUnit: "g",
        measureStep: 125,
        countStep: 1,
      });

      state = pantryReducer(
        state,
        add({ entryId: "entry-2", unit: "piece", amount: 3, step: 1 }),
      );
      record = state.catalogue["barcode:3017620422003"];
      // Switching form keeps the other form's remembered step.
      expect(record).toMatchObject({
        defaultUnit: "piece",
        measureStep: 125,
        countStep: 1,
      });
    });

    it("remembers the location", () => {
      const state = pantryReducer(hydrated(), add({ locationId: FREEZER.id }));
      expect(state.catalogue["barcode:3017620422003"]?.defaultLocationId).toBe(
        FREEZER.id,
      );
    });

    it("fills in details once a later lookup succeeds", () => {
      let state = pantryReducer(
        hydrated(),
        add({
          product: product({
            name: "Unknown product",
            needsName: true,
            category: null,
          }),
        }),
      );
      expect(state.catalogue["barcode:3017620422003"]).toMatchObject({
        needsName: true,
      });

      state = pantryReducer(state, add({ entryId: "entry-2" }));
      expect(state.catalogue["barcode:3017620422003"]).toMatchObject({
        name: "Nutella",
        category: "Hazelnut spreads",
        needsName: false,
      });
    });
  });
});

describe("consuming", () => {
  it("takes one step off", () => {
    let state = pantryReducer(hydrated(), add({ amount: 4 }));
    state = pantryReducer(state, {
      type: "CONSUME_ENTRY",
      id: "entry-1",
      now: NOW,
    });
    expect(visibleOf(state)[0]?.amount).toBe(3);
  });

  it("hides but does not delete the entry at zero", () => {
    let state = pantryReducer(hydrated(), add({ amount: 1 }));
    state = pantryReducer(state, {
      type: "CONSUME_ENTRY",
      id: "entry-1",
      now: NOW,
    });

    expect(visibleOf(state)).toHaveLength(0);
    expect(entriesOf(state)).toHaveLength(1);
    const only = entriesOf(state)[0];
    expect(only && isOutOfStock(only)).toBe(true);
    expect(only?.deletedAt).toBeNull();
  });

  it("leaves the catalogue record alone when an entry empties", () => {
    let state = pantryReducer(hydrated(), add({ amount: 1 }));
    state = pantryReducer(state, {
      type: "CONSUME_ENTRY",
      id: "entry-1",
      now: NOW,
    });
    expect(state.catalogue["barcode:3017620422003"]).toBeDefined();
  });

  it("ignores an unknown id", () => {
    const state = hydrated();
    expect(
      pantryReducer(state, { type: "CONSUME_ENTRY", id: "nope", now: NOW }),
    ).toBe(state);
  });
});

describe("REMOVE_ENTRY", () => {
  it("tombstones rather than dropping the record", () => {
    let state = pantryReducer(hydrated(), add({ amount: 4 }));
    state = pantryReducer(state, {
      type: "REMOVE_ENTRY",
      id: "entry-1",
      now: NOW,
    });

    expect(entriesOf(state)).toHaveLength(1);
    expect(entriesOf(state)[0]?.deletedAt).toBe(NOW);
    expect(visibleOf(state)).toHaveLength(0);
  });

  it("stays removed when acted on again", () => {
    let state = pantryReducer(hydrated(), add());
    state = pantryReducer(state, {
      type: "REMOVE_ENTRY",
      id: "entry-1",
      now: NOW,
    });
    const after = pantryReducer(state, {
      type: "RESTOCK_ENTRY",
      id: "entry-1",
      amount: 5,
      now: NOW,
    });
    expect(after).toBe(state);
  });
});

describe("RENAME_ENTRY_PRODUCT", () => {
  it("names a product that was added without a lookup", () => {
    let state = pantryReducer(
      hydrated(),
      add({ product: product({ name: "Unknown product", needsName: true }) }),
    );
    state = pantryReducer(state, {
      type: "RENAME_ENTRY_PRODUCT",
      id: "entry-1",
      name: "  Oat milk ",
      now: NOW,
    });

    expect(state.catalogue["barcode:3017620422003"]).toMatchObject({
      name: "Oat milk",
      needsName: false,
    });
  });

  it("ignores an empty name", () => {
    const state = pantryReducer(hydrated(), add());
    expect(
      pantryReducer(state, {
        type: "RENAME_ENTRY_PRODUCT",
        id: "entry-1",
        name: "   ",
        now: NOW,
      }),
    ).toBe(state);
  });
});

describe("locations", () => {
  it("adds one", () => {
    const state = pantryReducer(hydrated(), {
      type: "ADD_LOCATION",
      id: "loc-cellar",
      name: " Cellar ",
      now: NOW,
    });
    expect(state.locations["loc-cellar"]?.name).toBe("Cellar");
  });

  it("refuses a blank name", () => {
    const state = hydrated();
    expect(
      pantryReducer(state, {
        type: "ADD_LOCATION",
        id: "loc-x",
        name: "  ",
        now: NOW,
      }),
    ).toBe(state);
  });

  it("renaming keeps the entries in it", () => {
    let state = pantryReducer(hydrated(), add({ locationId: FRIDGE.id }));
    state = pantryReducer(state, {
      type: "RENAME_LOCATION",
      id: FRIDGE.id,
      name: "Cold shelf",
      now: NOW,
    });

    expect(state.locations[FRIDGE.id]?.name).toBe("Cold shelf");
    expect(visibleOf(state)[0]?.locationId).toBe(FRIDGE.id);
  });

  describe("removal never orphans entries", () => {
    it("reassigns the entries to the nominated destination", () => {
      let state = pantryReducer(hydrated(), add({ locationId: FRIDGE.id }));
      state = pantryReducer(state, {
        type: "REMOVE_LOCATION",
        id: FRIDGE.id,
        destinationId: CUPBOARD.id,
        now: NOW,
      });

      expect(state.locations[FRIDGE.id]?.deletedAt).toBe(NOW);
      expect(visibleOf(state)[0]?.locationId).toBe(CUPBOARD.id);
    });

    it("moves out-of-stock entries too", () => {
      let state = pantryReducer(
        hydrated(),
        add({ amount: 1, locationId: FRIDGE.id }),
      );
      state = pantryReducer(state, {
        type: "CONSUME_ENTRY",
        id: "entry-1",
        now: NOW,
      });
      state = pantryReducer(state, {
        type: "REMOVE_LOCATION",
        id: FRIDGE.id,
        destinationId: CUPBOARD.id,
        now: NOW,
      });

      expect(state.entries["entry-1"]?.locationId).toBe(CUPBOARD.id);
    });

    it("deletes no entry", () => {
      let state = pantryReducer(hydrated(), add({ locationId: FRIDGE.id }));
      state = pantryReducer(state, {
        type: "REMOVE_LOCATION",
        id: FRIDGE.id,
        destinationId: CUPBOARD.id,
        now: NOW,
      });
      expect(entriesOf(state).every((e) => e.deletedAt === null)).toBe(true);
    });

    it("refuses a destination that is the location itself", () => {
      const state = pantryReducer(hydrated(), add());
      expect(
        pantryReducer(state, {
          type: "REMOVE_LOCATION",
          id: FRIDGE.id,
          destinationId: FRIDGE.id,
          now: NOW,
        }),
      ).toBe(state);
    });

    it("refuses a destination that does not exist", () => {
      const state = pantryReducer(hydrated(), add());
      expect(
        pantryReducer(state, {
          type: "REMOVE_LOCATION",
          id: FRIDGE.id,
          destinationId: "loc-nope",
          now: NOW,
        }),
      ).toBe(state);
    });

    it("refuses to remove the last remaining location", () => {
      let state = hydrated();
      state = pantryReducer(state, {
        type: "REMOVE_LOCATION",
        id: FREEZER.id,
        destinationId: CUPBOARD.id,
        now: NOW,
      });
      state = pantryReducer(state, {
        type: "REMOVE_LOCATION",
        id: CUPBOARD.id,
        destinationId: FRIDGE.id,
        now: NOW,
      });
      // One left; there is no valid destination, so this is a no-op.
      const after = pantryReducer(state, {
        type: "REMOVE_LOCATION",
        id: FRIDGE.id,
        destinationId: CUPBOARD.id,
        now: NOW,
      });
      expect(after).toBe(state);
      expect(
        Object.values(after.locations).filter((l) => l.deletedAt === null),
      ).toHaveLength(1);
    });
  });
});

describe("MOVE_ENTRY", () => {
  it("moves an entry to another location", () => {
    let state = pantryReducer(hydrated(), add({ locationId: FRIDGE.id }));
    state = pantryReducer(state, {
      type: "MOVE_ENTRY",
      id: "entry-1",
      locationId: FREEZER.id,
      now: NOW,
    });
    expect(visibleOf(state)[0]?.locationId).toBe(FREEZER.id);
  });

  it("refuses a location that does not exist", () => {
    const state = pantryReducer(hydrated(), add());
    expect(
      pantryReducer(state, {
        type: "MOVE_ENTRY",
        id: "entry-1",
        locationId: "loc-nope",
        now: NOW,
      }),
    ).toBe(state);
  });
});

describe("every mutation stamps updatedAt", () => {
  it("does so for each entry-changing action", () => {
    const later = NOW + 60_000;
    let state = pantryReducer(hydrated(), add({ amount: 5 }));

    for (const action of [
      { type: "CONSUME_ENTRY", id: "entry-1", now: later },
      { type: "RESTOCK_ENTRY", id: "entry-1", amount: 1, now: later },
      { type: "SET_ENTRY_AMOUNT", id: "entry-1", amount: 2, now: later },
      { type: "MOVE_ENTRY", id: "entry-1", locationId: FREEZER.id, now: later },
      { type: "REMOVE_ENTRY", id: "entry-1", now: later },
    ] satisfies Action[]) {
      const next = pantryReducer(state, action);
      expect(next.entries["entry-1"]?.updatedAt).toBe(later);
      state = pantryReducer(state, action);
    }
  });
});

describe("the offline lookup cache stays a separate concern", () => {
  it("caches a product without touching the catalogue", () => {
    const state = pantryReducer(hydrated(), {
      type: "CACHE_PRODUCT",
      now: NOW,
      product: {
        barcode: "3017620422003",
        name: "Nutella",
        brand: "Ferrero",
        quantity: "400 g",
        imageUrl: null,
        nutriScore: "E",
        category: "Hazelnut spreads",
      },
    });

    expect(state.productCache["3017620422003"]).toMatchObject({
      cachedAt: NOW,
    });
    expect(state.catalogue).toEqual({});
  });
});

describe("RESTORE_BACKUP", () => {
  /** A pantry with one Nutella in the fridge and a cached product. */
  function populated(): PantryState {
    const withEntry = pantryReducer(hydrated(), add());
    return pantryReducer(withEntry, {
      type: "CACHE_PRODUCT",
      now: NOW,
      product: {
        barcode: "3017620422003",
        name: "Nutella",
        brand: "Ferrero",
        quantity: "400 g",
        imageUrl: null,
        nutriScore: "E",
        category: "Hazelnut spreads",
      },
    });
  }

  const restored = (): BackupContents => ({
    entries: {
      "restored-1": {
        id: "restored-1",
        productKey: "barcode:0000000000000",
        amount: 2,
        unit: "piece",
        step: 1,
        locationId: "loc-elsewhere",
        expiresAt: "2026-09-01",
        createdAt: 111,
        updatedAt: 222,
        deletedAt: null,
      },
    },
    catalogue: {
      "barcode:0000000000000": {
        id: "cat-restored",
        key: "barcode:0000000000000",
        barcode: "0000000000000",
        name: "Restored beans",
        brand: "",
        imageUrl: null,
        nutriScore: null,
        category: null,
        quantityText: "",
        needsName: false,
        defaultUnit: "piece",
        countStep: 1,
        measureStep: 100,
        measureUnit: "g",
        defaultLocationId: "loc-elsewhere",
        useCount: 1,
        shelfLifeDays: null,
        createdAt: 111,
        updatedAt: 222,
        deletedAt: null,
      },
    },
    locations: { "loc-elsewhere": location("loc-elsewhere", "Cellar") },
  });

  it("replaces the pantry rather than merging into it", () => {
    const state = pantryReducer(populated(), {
      type: "RESTORE_BACKUP",
      contents: restored(),
    });
    expect(Object.keys(state.entries)).toEqual(["restored-1"]);
    expect(Object.keys(state.catalogue)).toEqual(["barcode:0000000000000"]);
    expect(Object.keys(state.locations)).toEqual(["loc-elsewhere"]);
  });

  it("removes entries that existed before but are not in the backup", () => {
    const before = populated();
    expect(before.entries["entry-1"]).toBeDefined();
    const state = pantryReducer(before, {
      type: "RESTORE_BACKUP",
      contents: restored(),
    });
    expect(state.entries["entry-1"]).toBeUndefined();
  });

  it("copies identities and timestamps verbatim", () => {
    const state = pantryReducer(populated(), {
      type: "RESTORE_BACKUP",
      contents: restored(),
    });
    const entry = state.entries["restored-1"];
    expect(entry?.id).toBe("restored-1");
    expect(entry?.createdAt).toBe(111);
    expect(entry?.updatedAt).toBe(222);
    expect(entry?.expiresAt).toBe("2026-09-01");
  });

  it("does not renumber or clamp a tombstone", () => {
    const contents = restored();
    const only = contents.entries["restored-1"];
    if (!only) throw new Error("fixture is wrong");
    contents.entries["restored-1"] = { ...only, deletedAt: 999 };
    const state = pantryReducer(populated(), {
      type: "RESTORE_BACKUP",
      contents,
    });
    expect(state.entries["restored-1"]?.deletedAt).toBe(999);
  });

  it("leaves the offline product cache alone", () => {
    const before = populated();
    const state = pantryReducer(before, {
      type: "RESTORE_BACKUP",
      contents: restored(),
    });
    expect(state.productCache).toEqual(before.productCache);
    expect(state.productCache["3017620422003"]).toBeDefined();
  });

  it("round-trips a pantry through build, parse and restore unchanged", () => {
    const before = populated();
    const text = JSON.stringify(
      buildBackup(
        {
          entries: before.entries,
          catalogue: before.catalogue,
          locations: before.locations,
        },
        NOW,
      ),
    );
    const parsed = parseBackup(text);
    if (!parsed.ok)
      throw new Error(`unexpectedly rejected: ${parsed.reason.kind}`);
    const { contents } = repairBackup(parsed, SEED);

    const after = pantryReducer(hydrated(), {
      type: "RESTORE_BACKUP",
      contents,
    });
    expect(after.entries).toEqual(before.entries);
    expect(after.catalogue).toEqual(before.catalogue);
    expect(after.locations).toEqual(before.locations);
  });

  it("round-trips tombstones without resurrecting them", () => {
    const removed = pantryReducer(pantryReducer(hydrated(), add()), {
      type: "REMOVE_ENTRY",
      id: "entry-1",
      now: NOW,
    });
    const text = JSON.stringify(
      buildBackup(
        {
          entries: removed.entries,
          catalogue: removed.catalogue,
          locations: removed.locations,
        },
        NOW,
      ),
    );
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error("unexpectedly rejected");
    const after = pantryReducer(hydrated(), {
      type: "RESTORE_BACKUP",
      contents: repairBackup(parsed, SEED).contents,
    });
    expect(after.entries["entry-1"]?.deletedAt).toBe(NOW);
    expect(visibleOf(after)).toHaveLength(0);
  });
});
