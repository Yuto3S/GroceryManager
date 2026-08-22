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
  /**
   * Coarse category, used to group the pantry. A plain string for the same
   * reason as `nutriScore`: Open Food Facts category tags are free-form and
   * community-edited, so there is no closed set to narrow to. Null when the
   * product carries no usable tag — those group under "Other".
   */
  category: string | null;
}

/** A product held in the offline cache, with the eviction timestamp. */
export type CachedProduct = Product & { cachedAt: number };

/** barcode -> product, so re-scans work offline. */
export type ProductCache = Record<string, CachedProduct>;

// --- Pantry ---

/**
 * How an amount is expressed. A count is not a separate concept from a mass —
 * it is the same model with a step of one, which is why there is one union here
 * rather than a countable/bulk split running through every screen.
 */
export type Unit = "piece" | "g" | "ml";

/** The two units that describe a measure rather than a count. */
export type MeasureUnit = Exclude<Unit, "piece">;

/**
 * Fields every persisted record carries.
 *
 * Sync is not planned, but these three make it possible later without a
 * migration of user data: a client-generated UUID so two offline devices cannot
 * collide, `updatedAt` so concurrent edits can be ordered, and a `deletedAt`
 * tombstone so a delete cannot be silently undone by a stale copy.
 *
 * All three timestamps are UTC epoch milliseconds. They are *instants* — they
 * order edits. Calendar dates (expiry, arriving in a later change) are a
 * different thing and are stored as `YYYY-MM-DD`; see `expiresAt`.
 */
export interface Tracked {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Non-null means removed. Tombstoned records never reach the UI. */
  deletedAt: number | null;
}

/** Somewhere things are kept. A record, not a union — see design. */
export interface Location extends Tracked {
  name: string;
}

/**
 * The durable record of a product the user has added at least once.
 *
 * Distinct from `ProductCache`, which is a capped offline lookup cache with the
 * opposite retention policy. A catalogue that forgets would drop your staples
 * out of "things you've bought before" precisely because you bought them long
 * ago, so this one never evicts.
 */
export interface CatalogueEntry extends Tracked {
  /** Barcode when there is one, otherwise a key normalized from the name. */
  key: string;
  barcode: string | null;
  name: string;
  brand: string;
  imageUrl: string | null;
  nutriScore: string | null;
  category: string | null;
  /** The product's own quantity text, kept so defaults can be re-derived. */
  quantityText: string;
  /** True when the product could not be looked up and has no real name yet. */
  needsName: boolean;

  // Defaults, seeded from the product's own data and overwritten whenever the
  // user overrides them on an add. Both step forms are kept so switching
  // between counting and measuring does not lose the other one's setting.
  defaultUnit: Unit;
  countStep: number;
  measureStep: number;
  measureUnit: MeasureUnit;
  defaultLocationId: string | null;

  /** How many times this product has been added. Orders the catalogue picker. */
  useCount: number;

  /**
   * Days this product keeps for. Null until a later change supplies real shelf
   * lives; the merge rule's long-life clause is inert while it is null.
   */
  shelfLifeDays: number | null;
}

/**
 * One lot of one product in the pantry.
 *
 * Product details are not duplicated here — the entry points at a catalogue
 * record, which never evicts, so the reference always resolves. Two lots of the
 * same product bought a week apart are two entries pointing at one record.
 */
export interface PantryEntry extends Tracked {
  /** Points at a `CatalogueEntry.key`. */
  productKey: string;
  amount: number;
  unit: Unit;
  /** How much one consume action removes. */
  step: number;
  locationId: string;
  /**
   * A calendar date (`YYYY-MM-DD`), not an instant. "Best before 27 August" is
   * the same 27 August everywhere; storing it as a timestamp would force a
   * fabricated time-of-day and shift the day across timezones. Always null
   * until the expiry change lands — the field exists now so it is already the
   * right type when it does.
   */
  expiresAt: string | null;
}
