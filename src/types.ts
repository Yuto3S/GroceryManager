// Shared domain types.
//
// `Product` is deliberately the *normalized* shape — what comes back from
// `lookupProduct`, after `src/api/openFoodFacts.ts` has vetted every field.
// Nothing straight off the wire is ever typed as a Product: Open Food Facts is
// community-editable, so the raw response is `unknown` until it's been checked.

/** A product as the rest of the app is allowed to see it. */
export interface Product {
  barcode: string;
  name: string;
  brand: string;
  quantity: string;
  /** Always `https://`, or null. Rendered by <Image>, so never anything else. */
  imageUrl: string | null;
  /**
   * Upper-cased Nutri-Score grade. Left as a plain string rather than an
   * "A".."E" union because it originates from untrusted data — narrowing it
   * here would be an assertion, not a check. Look colours up with
   * `nutriColorFor`, which falls back for anything unrecognized.
   */
  nutriScore: string | null;
}

/** A product held in the offline cache, with the eviction timestamp. */
export type CachedProduct = Product & { cachedAt: number };

/** barcode -> product, so re-scans work offline. */
export type ProductCache = Record<string, CachedProduct>;

/** A row on the grocery list. Manually-added items have no barcode. */
export interface GroceryItem {
  id: string;
  name: string;
  brand: string;
  barcode: string | null;
  imageUrl: string | null;
  nutriScore: string | null;
  bought: boolean;
  addedAt: number;
  boughtAt: number | null;
}
