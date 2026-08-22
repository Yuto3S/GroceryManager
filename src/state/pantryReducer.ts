// The pantry state machine.
//
// A pure function: no React, no AsyncStorage, no clock, no id generator. Every
// non-deterministic input — the current time, a fresh UUID — arrives on the
// action, which is what makes the whole thing reachable by a test without
// rendering anything or faking a device.

import { capCache } from "../lib/cache";
import { catalogueKeyFor } from "../lib/identity";
import { decideMerge } from "../lib/merge";
import { consume, remove, restock, setAmount } from "../lib/pantry";
import type {
  CachedProduct,
  CatalogueEntry,
  Location,
  MeasureUnit,
  PantryEntry,
  Product,
  ProductCache,
  Unit,
} from "../types";

export interface PantryState {
  loaded: boolean;
  /** id -> entry. Includes out-of-stock and tombstoned records. */
  entries: Record<string, PantryEntry>;
  /** catalogue key -> record. Never evicted. */
  catalogue: Record<string, CatalogueEntry>;
  /** id -> location. */
  locations: Record<string, Location>;
  /** The capped offline lookup cache. A separate concern; see design. */
  productCache: ProductCache;
}

export const initialState: PantryState = {
  loaded: false,
  entries: {},
  catalogue: {},
  locations: {},
  productCache: {},
};

/** What an add needs to know about the product, however it was identified. */
export interface AddProductInput {
  key: string;
  barcode: string | null;
  name: string;
  brand: string;
  imageUrl: string | null;
  nutriScore: string | null;
  category: string | null;
  quantityText: string;
  /** True when the lookup failed and the product has no real name yet. */
  needsName: boolean;
  shelfLifeDays: number | null;
}

/**
 * Build the add payload for a product that was looked up successfully.
 *
 * Shelf life is null throughout this change — the field exists so the merge
 * rule is already the right shape when real shelf lives arrive.
 */
export function productInputFor(product: Product): AddProductInput | null {
  const key = catalogueKeyFor(product);
  if (key === null) return null;
  return {
    key,
    barcode: product.barcode,
    name: product.name,
    brand: product.brand,
    imageUrl: product.imageUrl,
    nutriScore: product.nutriScore,
    category: product.category,
    quantityText: product.quantity,
    needsName: false,
    shelfLifeDays: null,
  };
}

/**
 * Build the add payload for a barcode that could not be looked up — offline, or
 * simply not in the database.
 *
 * The entry is still creatable, because refusing to record something the user
 * physically has in their hand is the wrong answer. It is flagged as needing a
 * name so it can be filled in later.
 */
export function productInputForUnknownBarcode(
  barcode: string,
): AddProductInput {
  return {
    key: `barcode:${barcode}`,
    barcode,
    name: "Unknown product",
    brand: "",
    imageUrl: null,
    nutriScore: null,
    category: null,
    quantityText: "",
    needsName: true,
    shelfLifeDays: null,
  };
}

/** Build the add payload for a product the user typed the name of. */
export function productInputForName(name: string): AddProductInput | null {
  const key = catalogueKeyFor({ barcode: null, name });
  if (key === null) return null;
  return {
    key,
    barcode: null,
    name: name.trim(),
    brand: "",
    imageUrl: null,
    nutriScore: null,
    category: null,
    quantityText: "",
    needsName: false,
    shelfLifeDays: null,
  };
}

/** Build the add payload for a product picked out of the catalogue. */
export function productInputForRecord(record: CatalogueEntry): AddProductInput {
  return {
    key: record.key,
    barcode: record.barcode,
    name: record.name,
    brand: record.brand,
    imageUrl: record.imageUrl,
    nutriScore: record.nutriScore,
    category: record.category,
    quantityText: record.quantityText,
    needsName: record.needsName,
    shelfLifeDays: record.shelfLifeDays,
  };
}

/**
 * Every mutation the store understands.
 *
 * A discriminated union, so a typo in a `type` string is a compile error rather
 * than a dispatch that silently falls through to `default` and does nothing.
 *
 * HYDRATE's payloads are nullable because they come from `JSON.parse` of
 * whatever is on the device — the reducer defaults them rather than trusting.
 */
export type Action =
  | {
      type: "HYDRATE";
      entries: Record<string, PantryEntry> | null;
      catalogue: Record<string, CatalogueEntry> | null;
      locations: Record<string, Location> | null;
      productCache: ProductCache | null;
      /** Seeded locations, used only when none were persisted. */
      seedLocations: Location[];
    }
  | {
      type: "ADD_PRODUCT";
      now: number;
      /** Used only if no existing entry merges. */
      entryId: string;
      product: AddProductInput;
      amount: number;
      unit: Unit;
      step: number;
      measureUnit: MeasureUnit;
      locationId: string;
      /** Set by the rapid-scan flow; one-at-a-time adds leave it unset. */
      sameSession?: boolean;
    }
  | { type: "CONSUME_ENTRY"; id: string; now: number }
  | { type: "RESTOCK_ENTRY"; id: string; amount: number; now: number }
  | { type: "SET_ENTRY_AMOUNT"; id: string; amount: number; now: number }
  | { type: "MOVE_ENTRY"; id: string; locationId: string; now: number }
  | { type: "RENAME_ENTRY_PRODUCT"; id: string; name: string; now: number }
  | { type: "REMOVE_ENTRY"; id: string; now: number }
  | { type: "ADD_LOCATION"; id: string; name: string; now: number }
  | { type: "RENAME_LOCATION"; id: string; name: string; now: number }
  | {
      type: "REMOVE_LOCATION";
      id: string;
      /** Where this location's entries go. Required even when it looks empty. */
      destinationId: string;
      now: number;
    }
  | { type: "CACHE_PRODUCT"; product: Product; now: number };

/** Records that have been tombstoned are gone as far as everything else cares. */
function isLive<T extends { deletedAt: number | null }>(record: T): boolean {
  return record.deletedAt === null;
}

/**
 * Persisted data is whatever is on the device — an older build's shape, a
 * partial write, a corrupted file. Anything that is not a usable record map
 * becomes an empty one rather than crashing the app on launch.
 */
function asRecordMap<T>(value: unknown): Record<string, T> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, T> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      out[key] = entry as T;
    }
  }
  return out;
}

/**
 * Pick the entry a new addition should join, if any.
 *
 * Tombstoned entries are never candidates. Out-of-stock ones are — restocking
 * something you finished is the same question as adding a duplicate, and the
 * merge rule answers both. The most recent candidate wins, so a fresh lot is
 * preferred over one from months ago.
 */
function findMergeTarget(
  state: PantryState,
  action: Extract<Action, { type: "ADD_PRODUCT" }>,
): PantryEntry | null {
  let best: PantryEntry | null = null;

  for (const entry of Object.values(state.entries)) {
    if (!isLive(entry) || entry.productKey !== action.product.key) continue;
    // A merge adds an amount to an existing entry, so the units have to agree.
    // They normally do — both sides took their default from the same catalogue
    // record — but a user who switched form on the sheet gets a second row
    // rather than a silent unit conversion the system cannot perform.
    if (entry.unit !== action.unit) continue;

    const decision = decideMerge(
      {
        productKey: action.product.key,
        shelfLifeDays: action.product.shelfLifeDays,
        expiresAt: null,
        sameSession: action.sameSession,
      },
      entry,
      action.now,
    );
    if (!decision.merge) continue;

    if (best === null || entry.createdAt > best.createdAt) best = entry;
  }

  return best;
}

/** Create or update the catalogue record for a product that was just added. */
function upsertCatalogue(
  state: PantryState,
  action: Extract<Action, { type: "ADD_PRODUCT" }>,
): CatalogueEntry {
  const existing = state.catalogue[action.product.key];
  const isCount = action.unit === "piece";

  const base: CatalogueEntry = existing ?? {
    id: action.product.key,
    key: action.product.key,
    barcode: action.product.barcode,
    name: action.product.name,
    brand: action.product.brand,
    imageUrl: action.product.imageUrl,
    nutriScore: action.product.nutriScore,
    category: action.product.category,
    quantityText: action.product.quantityText,
    needsName: action.product.needsName,
    defaultUnit: action.unit,
    countStep: 1,
    measureStep: 100,
    measureUnit: action.measureUnit,
    defaultLocationId: action.locationId,
    useCount: 0,
    shelfLifeDays: action.product.shelfLifeDays,
    createdAt: action.now,
    updatedAt: action.now,
    deletedAt: null,
  };

  return {
    ...base,
    // Later lookups fill in details an offline add could not.
    name: action.product.needsName ? base.name : action.product.name,
    brand: action.product.brand || base.brand,
    imageUrl: action.product.imageUrl ?? base.imageUrl,
    nutriScore: action.product.nutriScore ?? base.nutriScore,
    category: action.product.category ?? base.category,
    quantityText: action.product.quantityText || base.quantityText,
    needsName: base.needsName && action.product.needsName,
    // The user's choices become next time's defaults. Both step forms are kept
    // so switching between counting and measuring does not lose the other.
    defaultUnit: action.unit,
    countStep: isCount ? action.step : base.countStep,
    measureStep: isCount ? base.measureStep : action.step,
    measureUnit: action.measureUnit,
    defaultLocationId: action.locationId,
    useCount: base.useCount + 1,
    deletedAt: null,
    updatedAt: action.now,
  };
}

/** Apply a change to one entry, if it exists and is still live. */
function mapEntry(
  state: PantryState,
  id: string,
  change: (entry: PantryEntry) => PantryEntry,
): PantryState {
  const entry = state.entries[id];
  if (!entry || !isLive(entry)) return state;
  return { ...state, entries: { ...state.entries, [id]: change(entry) } };
}

export function pantryReducer(state: PantryState, action: Action): PantryState {
  switch (action.type) {
    case "HYDRATE": {
      const locations = asRecordMap<Location>(action.locations);
      const hasLocation = Object.values(locations).some(isLive);
      const seeded = hasLocation
        ? locations
        : Object.fromEntries(action.seedLocations.map((l) => [l.id, l]));

      return {
        loaded: true,
        entries: asRecordMap<PantryEntry>(action.entries),
        catalogue: asRecordMap<CatalogueEntry>(action.catalogue),
        locations: seeded,
        productCache: capCache<CachedProduct>(
          asRecordMap<CachedProduct>(action.productCache),
        ),
      };
    }

    case "ADD_PRODUCT": {
      const catalogue = {
        ...state.catalogue,
        [action.product.key]: upsertCatalogue(state, action),
      };

      const target = findMergeTarget(state, action);
      if (target) {
        return {
          ...state,
          catalogue,
          entries: {
            ...state.entries,
            [target.id]: restock(target, action.amount, action.now),
          },
        };
      }

      const entry: PantryEntry = {
        id: action.entryId,
        productKey: action.product.key,
        amount: action.amount,
        unit: action.unit,
        step: action.step,
        locationId: action.locationId,
        expiresAt: null,
        createdAt: action.now,
        updatedAt: action.now,
        deletedAt: null,
      };

      return {
        ...state,
        catalogue,
        entries: { ...state.entries, [entry.id]: entry },
      };
    }

    case "CONSUME_ENTRY":
      return mapEntry(state, action.id, (e) => consume(e, action.now));

    case "RESTOCK_ENTRY":
      return mapEntry(state, action.id, (e) =>
        restock(e, action.amount, action.now),
      );

    case "SET_ENTRY_AMOUNT":
      return mapEntry(state, action.id, (e) =>
        setAmount(e, action.amount, action.now),
      );

    case "MOVE_ENTRY": {
      const destination = state.locations[action.locationId];
      if (!destination || !isLive(destination)) return state;
      return mapEntry(state, action.id, (e) => ({
        ...e,
        locationId: action.locationId,
        updatedAt: action.now,
      }));
    }

    case "RENAME_ENTRY_PRODUCT": {
      // Naming a product that was added offline or unrecognized. The name lives
      // on the catalogue record, so this reaches through the entry to it.
      const entry = state.entries[action.id];
      const name = action.name.trim();
      if (!entry || !isLive(entry) || name.length === 0) return state;

      const record = state.catalogue[entry.productKey];
      if (!record) return state;

      return {
        ...state,
        catalogue: {
          ...state.catalogue,
          [record.key]: {
            ...record,
            name,
            needsName: false,
            updatedAt: action.now,
          },
        },
      };
    }

    case "REMOVE_ENTRY":
      return mapEntry(state, action.id, (e) => remove(e, action.now));

    case "ADD_LOCATION": {
      const name = action.name.trim();
      if (name.length === 0) return state;
      const location: Location = {
        id: action.id,
        name,
        createdAt: action.now,
        updatedAt: action.now,
        deletedAt: null,
      };
      return {
        ...state,
        locations: { ...state.locations, [location.id]: location },
      };
    }

    case "RENAME_LOCATION": {
      const location = state.locations[action.id];
      const name = action.name.trim();
      if (!location || !isLive(location) || name.length === 0) return state;
      // Entries reference a location by id, so renaming moves nothing.
      return {
        ...state,
        locations: {
          ...state.locations,
          [location.id]: { ...location, name, updatedAt: action.now },
        },
      };
    }

    case "REMOVE_LOCATION": {
      const location = state.locations[action.id];
      const destination = state.locations[action.destinationId];
      if (!location || !isLive(location)) return state;
      if (!destination || !isLive(destination)) return state;
      if (destination.id === location.id) return state;

      // Refusing to remove the last one: there would be nowhere for a future
      // entry to go. `destination` being live already implies another exists,
      // but stating it here keeps the rule visible rather than incidental.
      const liveCount = Object.values(state.locations).filter(isLive).length;
      if (liveCount <= 1) return state;

      // Out-of-stock entries move too. They are still records of something
      // that lived in this location, and leaving them pointing at a removed
      // one is exactly the orphan this reassignment exists to prevent.
      const entries = { ...state.entries };
      for (const entry of Object.values(state.entries)) {
        if (entry.locationId !== location.id) continue;
        entries[entry.id] = {
          ...entry,
          locationId: destination.id,
          updatedAt: action.now,
        };
      }

      return {
        ...state,
        entries,
        locations: {
          ...state.locations,
          [location.id]: {
            ...location,
            deletedAt: action.now,
            updatedAt: action.now,
          },
        },
      };
    }

    case "CACHE_PRODUCT":
      return {
        ...state,
        productCache: capCache<CachedProduct>({
          ...state.productCache,
          [action.product.barcode]: {
            ...action.product,
            cachedAt: action.now,
          },
        }),
      };

    default: {
      // Exhaustiveness check: add a variant to `Action` without a case above
      // and this assignment stops compiling. Still returns `state` at runtime,
      // so a stray action from older persisted code is a no-op, not a crash.
      const _exhaustive: never = action;
      return state;
    }
  }
}
