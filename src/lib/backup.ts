// Building and validating the backup document.
//
// Two jobs, and the second is the reason this file is pure and separate. A
// backup that comes back in has been sitting in a filesystem: it can be
// hand-edited, truncated by a failed transfer, or simply be some other JSON
// file the user tapped by mistake. It gets exactly the treatment an Open Food
// Facts response gets — parsed as `unknown`, then checked field by field. There
// is no point in this file where a value is asserted to have a shape.
//
// The repair pass lives here too, rather than in the reducer, because a dangling
// reference is a property of the *file*, not of the pantry. The reducer receives
// state that is already consistent.

import type {
  CatalogueEntry,
  Location,
  MeasureUnit,
  PantryEntry,
  Unit,
} from "../types";

/**
 * Marks the document as ours. Without it, any JSON file that happened to have
 * an `entries` key would be accepted as a backup.
 */
export const BACKUP_FORMAT = "grocery-scanner.pantry";

/**
 * One integer for the whole document, not one per slice. The slices reference
 * each other, so they can only ever version together.
 */
export const BACKUP_VERSION = 1;

/** What is written to the file. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** UTC epoch milliseconds, like every other instant in the app. */
  exportedAt: number;
  entries: Record<string, PantryEntry>;
  catalogue: Record<string, CatalogueEntry>;
  locations: Record<string, Location>;
}

/** The three slices, in the shape the reducer holds them. */
export interface BackupContents {
  entries: Record<string, PantryEntry>;
  catalogue: Record<string, CatalogueEntry>;
  locations: Record<string, Location>;
}

// --- Building ---

/**
 * Build the backup document.
 *
 * Everything the user entered goes in, tombstones included — a removal is a
 * fact about their pantry, and dropping it would resurrect the record on the
 * next restore. The product cache does not, because the app can rebuild it and
 * a backup is a copy of the user's work, not of the app's state.
 */
export function buildBackup(contents: BackupContents, now: number): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    entries: contents.entries,
    catalogue: contents.catalogue,
    locations: contents.locations,
  };
}

/** `pantry-backup-2026-08-23.json`, built from local calendar components. */
export function backupFilename(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `pantry-backup-${date}-${time}.json`;
}

// --- Parsing ---

/**
 * Why a file was refused outright.
 *
 * Distinct from a dropped record: these mean the document is not a backup, so
 * nothing in it can be trusted. A malformed *record* is a different case and is
 * handled by dropping just that record.
 */
export type BackupRejection =
  | { kind: "not-json" }
  | { kind: "not-a-backup" }
  | { kind: "future-version"; version: number; supported: number };

/** A backup that parsed, with the count of records that did not. */
export interface ParsedBackup {
  backup: Backup;
  /** Records dropped during validation, across all three slices. */
  droppedMalformed: number;
  /** Entries kept, but with an unparseable expiry date cleared. */
  clearedExpiry: number;
}

export type ParseResult =
  | ({ ok: true } & ParsedBackup)
  | { ok: false; reason: BackupRejection };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A finite number, or null. `NaN` and `Infinity` survive JSON round trips. */
function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asUnit(value: unknown): Unit | null {
  return value === "piece" || value === "g" || value === "ml" ? value : null;
}

function asMeasureUnit(value: unknown): MeasureUnit {
  return value === "ml" ? "ml" : "g";
}

/**
 * A calendar date, or null. Checked against the pattern rather than handed to
 * `new Date`, which accepts a great deal that is not `YYYY-MM-DD` and would put
 * an unparseable string into a field the UI formats.
 */
function asCalendarDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

/**
 * The four `Tracked` fields, or null if any is unusable.
 *
 * Timestamps are copied verbatim. Clamping them to now, or renumbering ids,
 * would break the round trip and destroy the edit ordering a future sync
 * depends on.
 */
type TrackedFields = {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

function trackedFields(raw: Record<string, unknown>): TrackedFields | null {
  const id = asNonEmptyString(raw.id);
  const createdAt = asFiniteNumber(raw.createdAt);
  const updatedAt = asFiniteNumber(raw.updatedAt);
  if (id === null || createdAt === null || updatedAt === null) return null;
  const deletedAt =
    raw.deletedAt === null ? null : asFiniteNumber(raw.deletedAt);
  return { id, createdAt, updatedAt, deletedAt };
}

function parseLocation(raw: unknown): Location | null {
  if (!isRecord(raw)) return null;
  const tracked = trackedFields(raw);
  const name = asNonEmptyString(raw.name);
  if (tracked === null || name === null) return null;
  return { ...tracked, name };
}

function parseCatalogueEntry(raw: unknown): CatalogueEntry | null {
  if (!isRecord(raw)) return null;
  const tracked = trackedFields(raw);
  const key = asNonEmptyString(raw.key);
  const name = asNonEmptyString(raw.name);
  if (tracked === null || key === null || name === null) return null;

  // Defaults below this line are recoverable: a catalogue record with a bad
  // step is still the user's product, and a step of one is never wrong enough
  // to be worth throwing the record away over.
  const countStep = asFiniteNumber(raw.countStep);
  const measureStep = asFiniteNumber(raw.measureStep);
  const useCount = asFiniteNumber(raw.useCount);

  return {
    ...tracked,
    key,
    barcode: asStringOrNull(raw.barcode),
    name,
    brand: asStringOrEmpty(raw.brand),
    imageUrl: safeImageUrl(raw.imageUrl),
    nutriScore: asStringOrNull(raw.nutriScore),
    category: asStringOrNull(raw.category),
    quantityText: asStringOrEmpty(raw.quantityText),
    needsName: raw.needsName === true,
    defaultUnit: asUnit(raw.defaultUnit) ?? "piece",
    countStep: countStep !== null && countStep > 0 ? Math.round(countStep) : 1,
    measureStep:
      measureStep !== null && measureStep > 0 ? Math.round(measureStep) : 100,
    measureUnit: asMeasureUnit(raw.measureUnit),
    defaultLocationId: asStringOrNull(raw.defaultLocationId),
    useCount: useCount !== null && useCount > 0 ? Math.round(useCount) : 1,
    shelfLifeDays: asFiniteNumber(raw.shelfLifeDays),
  };
}

/**
 * Same rule as the API layer: an image URL reaches an <Image> component, so
 * anything that is not plainly `https://` becomes null rather than being
 * rendered.
 */
function safeImageUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("https://")
    ? value
    : null;
}

function parseEntry(raw: unknown): PantryEntry | null {
  if (!isRecord(raw)) return null;
  const tracked = trackedFields(raw);
  const productKey = asNonEmptyString(raw.productKey);
  const locationId = asNonEmptyString(raw.locationId);
  const amount = asFiniteNumber(raw.amount);
  const unit = asUnit(raw.unit);
  if (
    tracked === null ||
    productKey === null ||
    locationId === null ||
    amount === null ||
    unit === null
  ) {
    return null;
  }
  const step = asFiniteNumber(raw.step);
  return {
    ...tracked,
    productKey,
    amount: Math.max(0, Math.round(amount)),
    unit,
    step: step !== null && step > 0 ? Math.round(step) : 1,
    locationId,
    expiresAt: asCalendarDate(raw.expiresAt),
  };
}

/**
 * Parse a slice, dropping records that do not survive validation.
 *
 * Returns the count dropped as well, because an unreported drop is a lie about
 * what was restored. The map key is taken from the record itself rather than
 * from the JSON key: a hand-edited file can disagree with itself, and the
 * record is the thing the rest of the app looks up by.
 */
function parseSlice<T extends { id: string }>(
  raw: unknown,
  parse: (value: unknown) => T | null,
): { records: Record<string, T>; dropped: number } {
  if (!isRecord(raw)) return { records: {}, dropped: 0 };
  const records: Record<string, T> = {};
  let dropped = 0;
  for (const value of Object.values(raw)) {
    const parsed = parse(value);
    if (parsed === null) {
      dropped += 1;
      continue;
    }
    records[parsed.id] = parsed;
  }
  return { records, dropped };
}

/**
 * Entries, with a count of expiry dates that had to be cleared.
 *
 * An unparseable expiry is nulled rather than costing the user the entry — the
 * same reasoning as the location repair — but it is a repair, so it is counted
 * and reported rather than done quietly.
 */
function parseEntries(raw: unknown): {
  records: Record<string, PantryEntry>;
  dropped: number;
  clearedExpiry: number;
} {
  if (!isRecord(raw)) return { records: {}, dropped: 0, clearedExpiry: 0 };
  const records: Record<string, PantryEntry> = {};
  let dropped = 0;
  let clearedExpiry = 0;
  for (const value of Object.values(raw)) {
    const parsed = parseEntry(value);
    if (parsed === null) {
      dropped += 1;
      continue;
    }
    if (
      parsed.expiresAt === null &&
      isRecord(value) &&
      value.expiresAt !== null &&
      value.expiresAt !== undefined
    ) {
      clearedExpiry += 1;
    }
    records[parsed.id] = parsed;
  }
  return { records, dropped, clearedExpiry };
}

/** The catalogue is keyed by `key`, not by `id`. */
function parseCatalogue(raw: unknown): {
  records: Record<string, CatalogueEntry>;
  dropped: number;
} {
  if (!isRecord(raw)) return { records: {}, dropped: 0 };
  const records: Record<string, CatalogueEntry> = {};
  let dropped = 0;
  for (const value of Object.values(raw)) {
    const parsed = parseCatalogueEntry(value);
    if (parsed === null) {
      dropped += 1;
      continue;
    }
    records[parsed.key] = parsed;
  }
  return { records, dropped };
}

/**
 * Turn a file's text into a backup, or say why it is not one.
 *
 * Structural failure rejects the whole document and changes nothing. A single
 * malformed record does not: rejecting a hundred-item backup because one entry
 * is broken would cost the user their pantry to protect them from one yoghurt.
 */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: { kind: "not-json" } };
  }

  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, reason: { kind: "not-a-backup" } };
  }

  const version = asFiniteNumber(raw.version);
  if (version === null) {
    return { ok: false, reason: { kind: "not-a-backup" } };
  }
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: {
        kind: "future-version",
        version,
        supported: BACKUP_VERSION,
      },
    };
  }

  const exportedAt = asFiniteNumber(raw.exportedAt);
  if (exportedAt === null) {
    return { ok: false, reason: { kind: "not-a-backup" } };
  }

  const entries = parseEntries(raw.entries);
  const catalogue = parseCatalogue(raw.catalogue);
  const locations = parseSlice(raw.locations, parseLocation);

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version,
      exportedAt,
      entries: entries.records,
      catalogue: catalogue.records,
      locations: locations.records,
    },
    droppedMalformed: entries.dropped + catalogue.dropped + locations.dropped,
    clearedExpiry: entries.clearedExpiry,
  };
}

// --- Repair ---

/** What an import did, in enough detail that no repair goes unmentioned. */
export interface ImportReport {
  entries: number;
  catalogue: number;
  locations: number;
  /** Records that did not survive validation. */
  droppedMalformed: number;
  /** Entries dropped because their catalogue record was absent. */
  droppedMissingProduct: number;
  /** Entries dropped because there was nowhere at all to put them. */
  droppedNoLocation: number;
  /** Entries kept with an unparseable expiry date cleared. */
  clearedExpiry: number;
  /** Entries moved because their location was absent. */
  reassignedLocation: number;
  /** True when the backup had no usable location and defaults were created. */
  seededLocations: boolean;
}

export interface RepairResult {
  contents: BackupContents;
  report: ImportReport;
}

/**
 * Make a parsed backup internally consistent.
 *
 * The two repairs are deliberately not symmetric:
 *
 *   missing location -> reassign. An entry in the wrong place is still your
 *                       yoghurt, and the user can move it.
 *   missing product  -> drop. An entry with no catalogue record has no name,
 *                       no unit defaults and nothing to render.
 *
 * `seedLocations` is passed in rather than generated here so this stays pure —
 * the ids come from the caller, as everywhere else in the codebase.
 */
export function repairBackup(
  parsed: ParsedBackup,
  seedLocations: Location[],
): RepairResult {
  const { backup } = parsed;

  let locations = backup.locations;
  let seededLocations = false;
  const hasLiveLocation = Object.values(locations).some(
    (l) => l.deletedAt === null,
  );
  if (!hasLiveLocation) {
    locations = Object.fromEntries(seedLocations.map((l) => [l.id, l]));
    seededLocations = true;
  }

  // The landing place for reassignments: the oldest live location, matching
  // how the rest of the app orders them.
  const fallback = Object.values(locations)
    .filter((l) => l.deletedAt === null)
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  const entries: Record<string, PantryEntry> = {};
  let droppedMissingProduct = 0;
  let droppedNoLocation = 0;
  let reassignedLocation = 0;

  for (const entry of Object.values(backup.entries)) {
    if (!backup.catalogue[entry.productKey]) {
      droppedMissingProduct += 1;
      continue;
    }
    if (locations[entry.locationId]) {
      entries[entry.id] = entry;
      continue;
    }
    // `fallback` is only undefined when seeding produced nothing, i.e. the
    // caller passed an empty seed list. Drop rather than write an entry
    // pointing at a location that does not exist.
    if (!fallback) {
      droppedNoLocation += 1;
      continue;
    }
    entries[entry.id] = { ...entry, locationId: fallback.id };
    reassignedLocation += 1;
  }

  return {
    contents: { entries, catalogue: backup.catalogue, locations },
    report: {
      entries: Object.keys(entries).length,
      catalogue: Object.keys(backup.catalogue).length,
      locations: Object.keys(locations).length,
      droppedMalformed: parsed.droppedMalformed,
      droppedMissingProduct,
      droppedNoLocation,
      clearedExpiry: parsed.clearedExpiry,
      reassignedLocation,
      seededLocations,
    },
  };
}
