// Global app state: the grocery list + an offline cache of scanned products.
// Everything is persisted to the device with AsyncStorage, so it survives
// closing the app and works offline.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { capCache } from "../lib/cache";

const LIST_KEY = "@grocery/list/v1";
const CACHE_KEY = "@grocery/productCache/v1";

const GroceryContext = createContext(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const initialState = {
  loaded: false,
  items: [], // { id, name, brand, barcode, imageUrl, nutriScore, bought, addedAt, boughtAt }
  productCache: {}, // barcode -> product (so re-scans work offline)
};

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        loaded: true,
        items: action.items ?? [],
        productCache: capCache(action.productCache ?? {}),
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
        productCache: capCache({
          ...state.productCache,
          [action.product.barcode]: {
            ...action.product,
            cachedAt: Date.now(),
          },
        }),
      };

    default:
      return state;
  }
}

export function GroceryProvider({ children }) {
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

  const addManualItem = useCallback((name) => {
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

  const addProduct = useCallback((product, { bought = false } = {}) => {
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
  }, []);

  const cacheProduct = useCallback((product) => {
    dispatch({ type: "CACHE_PRODUCT", product });
  }, []);

  const toggleBought = useCallback((id) => {
    dispatch({ type: "TOGGLE_BOUGHT", id });
  }, []);

  const removeItem = useCallback((id) => {
    dispatch({ type: "REMOVE_ITEM", id });
  }, []);

  const clearBought = useCallback(() => {
    dispatch({ type: "CLEAR_BOUGHT" });
  }, []);

  const value = {
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

export function useGrocery() {
  const ctx = useContext(GroceryContext);
  if (!ctx) {
    throw new Error("useGrocery must be used inside a <GroceryProvider>");
  }
  return ctx;
}
