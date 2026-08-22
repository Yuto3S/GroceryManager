// Global app state: the pantry, the product catalogue, the locations, and the
// offline product cache. Everything is persisted with AsyncStorage, so it
// survives closing the app and works offline.
//
// All the logic lives in `pantryReducer.ts`, which is pure and tested directly.
// What is left here is the part that cannot be pure: reading the clock,
// generating ids, and talking to storage. Keeping that boundary sharp is also
// what would let a sync engine slot in underneath one day.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import type {
  CatalogueEntry,
  Location,
  MeasureUnit,
  PantryEntry,
  Product,
  ProductCache,
  Unit,
} from "../types";
import {
  type AddProductInput,
  initialState,
  pantryReducer,
} from "./pantryReducer";

const ENTRIES_KEY = "@pantry/entries/v1";
const CATALOGUE_KEY = "@pantry/catalogue/v1";
const LOCATIONS_KEY = "@pantry/locations/v1";
const CACHE_KEY = "@pantry/productCache/v1";

/**
 * The locations a new install starts with. Seeded rather than hardcoded as a
 * union type, so adding a cellar later is a row and not a migration.
 */
const SEED_LOCATION_NAMES = ["Fridge", "Freezer", "Cupboard"];

/** What the add sheet hands over once the user confirms. */
export interface AddProductOptions {
  product: AddProductInput;
  amount: number;
  unit: Unit;
  step: number;
  measureUnit: MeasureUnit;
  locationId: string;
  /** Set by the rapid-scan flow; one-at-a-time adds leave it unset. */
  sameSession?: boolean;
}

interface PantryContextValue {
  loaded: boolean;
  /** Every entry, including out-of-stock and tombstoned ones. */
  entries: Record<string, PantryEntry>;
  catalogue: Record<string, CatalogueEntry>;
  locations: Location[];
  productCache: ProductCache;

  addProduct: (options: AddProductOptions) => void;
  consumeEntry: (id: string) => void;
  restockEntry: (id: string, amount: number) => void;
  setEntryAmount: (id: string, amount: number) => void;
  moveEntry: (id: string, locationId: string) => void;
  renameEntryProduct: (id: string, name: string) => void;
  removeEntry: (id: string) => void;

  addLocation: (name: string) => void;
  renameLocation: (id: string, name: string) => void;
  removeLocation: (id: string, destinationId: string) => void;

  cacheProduct: (product: Product) => void;
}

const PantryContext = createContext<PantryContextValue | null>(null);

/** Parse persisted JSON without letting a bad payload stop the app launching. */
function readJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // The reducer treats anything unusable as empty; a corrupt file is not a
    // reason to refuse to start.
    return null;
  }
}

function seedLocations(now: number): Location[] {
  return SEED_LOCATION_NAMES.map((name) => ({
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}

export function PantryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pantryReducer, initialState);

  // Load persisted data once on startup.
  useEffect(() => {
    (async () => {
      const now = Date.now();
      try {
        const [entries, catalogue, locations, cache] = await Promise.all([
          AsyncStorage.getItem(ENTRIES_KEY),
          AsyncStorage.getItem(CATALOGUE_KEY),
          AsyncStorage.getItem(LOCATIONS_KEY),
          AsyncStorage.getItem(CACHE_KEY),
        ]);
        dispatch({
          type: "HYDRATE",
          entries: readJson(entries) as never,
          catalogue: readJson(catalogue) as never,
          locations: readJson(locations) as never,
          productCache: readJson(cache) as never,
          seedLocations: seedLocations(now),
        });
      } catch (e) {
        console.warn("Failed to load saved data", e);
        dispatch({
          type: "HYDRATE",
          entries: null,
          catalogue: null,
          locations: null,
          productCache: null,
          seedLocations: seedLocations(now),
        });
      }
    })();
  }, []);

  // Persist each slice whenever it changes, but never before the first load —
  // writing here while `loaded` is false would overwrite the device's data
  // with the empty initial state.
  usePersist(ENTRIES_KEY, state.entries, state.loaded);
  usePersist(CATALOGUE_KEY, state.catalogue, state.loaded);
  usePersist(LOCATIONS_KEY, state.locations, state.loaded);
  usePersist(CACHE_KEY, state.productCache, state.loaded);

  const addProduct = useCallback((options: AddProductOptions) => {
    dispatch({
      type: "ADD_PRODUCT",
      now: Date.now(),
      entryId: randomUUID(),
      ...options,
    });
  }, []);

  const consumeEntry = useCallback((id: string) => {
    dispatch({ type: "CONSUME_ENTRY", id, now: Date.now() });
  }, []);

  const restockEntry = useCallback((id: string, amount: number) => {
    dispatch({ type: "RESTOCK_ENTRY", id, amount, now: Date.now() });
  }, []);

  const setEntryAmount = useCallback((id: string, amount: number) => {
    dispatch({ type: "SET_ENTRY_AMOUNT", id, amount, now: Date.now() });
  }, []);

  const moveEntry = useCallback((id: string, locationId: string) => {
    dispatch({ type: "MOVE_ENTRY", id, locationId, now: Date.now() });
  }, []);

  const renameEntryProduct = useCallback((id: string, name: string) => {
    dispatch({ type: "RENAME_ENTRY_PRODUCT", id, name, now: Date.now() });
  }, []);

  const removeEntry = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ENTRY", id, now: Date.now() });
  }, []);

  const addLocation = useCallback((name: string) => {
    dispatch({ type: "ADD_LOCATION", id: randomUUID(), name, now: Date.now() });
  }, []);

  const renameLocation = useCallback((id: string, name: string) => {
    dispatch({ type: "RENAME_LOCATION", id, name, now: Date.now() });
  }, []);

  const removeLocation = useCallback((id: string, destinationId: string) => {
    dispatch({ type: "REMOVE_LOCATION", id, destinationId, now: Date.now() });
  }, []);

  const cacheProduct = useCallback((product: Product) => {
    dispatch({ type: "CACHE_PRODUCT", product, now: Date.now() });
  }, []);

  // Locations are handed out as a list, already filtered and ordered, because
  // every caller wants exactly that and none of them should have to know that
  // removal is a tombstone rather than a delete.
  const locations = useMemo(
    () =>
      Object.values(state.locations)
        .filter((l) => l.deletedAt === null)
        .sort((a, b) => a.createdAt - b.createdAt),
    [state.locations],
  );

  const value: PantryContextValue = {
    loaded: state.loaded,
    entries: state.entries,
    catalogue: state.catalogue,
    locations,
    productCache: state.productCache,
    addProduct,
    consumeEntry,
    restockEntry,
    setEntryAmount,
    moveEntry,
    renameEntryProduct,
    removeEntry,
    addLocation,
    renameLocation,
    removeLocation,
    cacheProduct,
  };

  return (
    <PantryContext.Provider value={value}>{children}</PantryContext.Provider>
  );
}

/** Write one slice to storage whenever it changes, after the first load. */
function usePersist(key: string, value: unknown, loaded: boolean): void {
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) =>
      console.warn(`Failed to save ${key}`, e),
    );
  }, [key, value, loaded]);
}

export function usePantry(): PantryContextValue {
  const ctx = useContext(PantryContext);
  if (!ctx) {
    throw new Error("usePantry must be used inside a <PantryProvider>");
  }
  return ctx;
}
