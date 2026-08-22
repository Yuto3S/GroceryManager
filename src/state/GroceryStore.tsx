// Global app state: the grocery list + an offline cache of scanned products.
// Everything is persisted to the device with AsyncStorage, so it survives
// closing the app and works offline.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { capCache } from "../lib/cache";
import type {
  CachedProduct,
  GroceryItem,
  Product,
  ProductCache,
} from "../types";

const LIST_KEY = "@grocery/list/v1";
const CACHE_KEY = "@grocery/productCache/v1";

interface State {
  loaded: boolean;
  items: GroceryItem[];
  productCache: ProductCache;
}

/**
 * Every mutation the store understands.
 *
 * A discriminated union, so a typo in a `type` string is a compile error rather
 * than a dispatch that silently falls through to `default` and does nothing.
 *
 * HYDRATE's payload is nullable because it comes from `JSON.parse` of whatever
 * is on the device — the reducer defaults it rather than trusting it.
 */
type Action =
  | {
      type: "HYDRATE";
      items: GroceryItem[] | null;
      productCache: ProductCache | null;
    }
  | { type: "ADD_ITEM"; item: GroceryItem }
  | { type: "TOGGLE_BOUGHT"; id: string }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "CLEAR_BOUGHT" }
  | { type: "CACHE_PRODUCT"; product: Product };

interface GroceryContextValue {
  loaded: boolean;
  items: GroceryItem[];
  productCache: ProductCache;
  addManualItem: (name: string) => void;
  addProduct: (product: Product, options?: { bought?: boolean }) => void;
  cacheProduct: (product: Product) => void;
  toggleBought: (id: string) => void;
  removeItem: (id: string) => void;
  clearBought: () => void;
}

const GroceryContext = createContext<GroceryContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const initialState: State = {
  loaded: false,
  items: [],
  productCache: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        loaded: true,
        items: action.items ?? [],
        productCache: capCache<CachedProduct>(action.productCache ?? {}),
      };

    case "ADD_ITEM":
      return { ...state, items: [action.item, ...state.items] };

    case "TOGGLE_BOUGHT":
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === action.id
            ? {
                ...it,
                bought: !it.bought,
                boughtAt: !it.bought ? Date.now() : null,
              }
            : it,
        ),
      };

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((it) => it.id !== action.id),
      };

    case "CLEAR_BOUGHT":
      return { ...state, items: state.items.filter((it) => !it.bought) };

    case "CACHE_PRODUCT":
      return {
        ...state,
        productCache: capCache<CachedProduct>({
          ...state.productCache,
          [action.product.barcode]: {
            ...action.product,
            cachedAt: Date.now(),
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

export function GroceryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load persisted data once on startup.
  useEffect(() => {
    (async () => {
      try {
        const [listRaw, cacheRaw] = await Promise.all([
          AsyncStorage.getItem(LIST_KEY),
          AsyncStorage.getItem(CACHE_KEY),
        ]);
        dispatch({
          type: "HYDRATE",
          items: listRaw ? JSON.parse(listRaw) : [],
          productCache: cacheRaw ? JSON.parse(cacheRaw) : {},
        });
      } catch (e) {
        console.warn("Failed to load saved data", e);
        dispatch({ type: "HYDRATE", items: [], productCache: {} });
      }
    })();
  }, []);

  // Persist the list whenever it changes (after initial load).
  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(LIST_KEY, JSON.stringify(state.items)).catch((e) =>
      console.warn("Failed to save list", e),
    );
  }, [state.items, state.loaded]);

  // Persist the product cache whenever it changes.
  useEffect(() => {
    if (!state.loaded) return;
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state.productCache)).catch(
      (e) => console.warn("Failed to save cache", e),
    );
  }, [state.productCache, state.loaded]);

  // --- Actions exposed to the rest of the app ---

  const addManualItem = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({
      type: "ADD_ITEM",
      item: {
        id: makeId(),
        name: trimmed,
        brand: "",
        barcode: null,
        imageUrl: null,
        nutriScore: null,
        bought: false,
        addedAt: Date.now(),
        boughtAt: null,
      },
    });
  }, []);

  const addProduct = useCallback(
    (product: Product, { bought = false }: { bought?: boolean } = {}) => {
      dispatch({ type: "CACHE_PRODUCT", product });
      dispatch({
        type: "ADD_ITEM",
        item: {
          id: makeId(),
          name: product.name,
          brand: product.brand,
          barcode: product.barcode,
          imageUrl: product.imageUrl,
          nutriScore: product.nutriScore,
          bought,
          addedAt: Date.now(),
          boughtAt: bought ? Date.now() : null,
        },
      });
    },
    [],
  );

  const cacheProduct = useCallback((product: Product) => {
    dispatch({ type: "CACHE_PRODUCT", product });
  }, []);

  const toggleBought = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_BOUGHT", id });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ITEM", id });
  }, []);

  const clearBought = useCallback(() => {
    dispatch({ type: "CLEAR_BOUGHT" });
  }, []);

  const value: GroceryContextValue = {
    loaded: state.loaded,
    items: state.items,
    productCache: state.productCache,
    addManualItem,
    addProduct,
    cacheProduct,
    toggleBought,
    removeItem,
    clearBought,
  };

  return (
    <GroceryContext.Provider value={value}>{children}</GroceryContext.Provider>
  );
}

export function useGrocery(): GroceryContextValue {
  const ctx = useContext(GroceryContext);
  if (!ctx) {
    throw new Error("useGrocery must be used inside a <GroceryProvider>");
  }
  return ctx;
}
