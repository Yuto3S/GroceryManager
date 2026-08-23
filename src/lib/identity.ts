// Stable identity for the product catalogue.
//
// A product with a barcode identifies itself. A product the user typed does not,
// so its key is derived from the name — and has to survive the ways the same
// name gets typed twice: different case, a trailing space, an accent the user
// could not be bothered to reach for.
//
// Both forms are prefixed. Without that, typing "12345678" as a name would land
// on the catalogue record for a real barcode.

/** Longest name worth keying on. Beyond this it is not a product name. */
const MAX_NAME_LENGTH = 120;

/**
 * Strip diacritics so `Crème` and `creme` are the same product.
 *
 * Guarded because `normalize` is the one string method that has historically
 * been missing from a JS engine we might run on; without it the accented and
 * unaccented spellings simply stay distinct, which is a worse key rather than
 * a crash.
 */
function stripDiacritics(value: string): string {
  if (typeof value.normalize !== "function") return value;
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Reduce a typed product name to its comparison form.
 *
 * Lower-cased, unaccented, punctuation dropped, and all runs of whitespace
 * collapsed to one space — so `  Crème   Fraîche! ` and `creme fraiche` agree.
 *
 * @param name - whatever the user typed, or anything else at all.
 * @returns the normalized form, or `null` when nothing usable is left.
 */
export function normalizeName(name: unknown): string | null {
  if (typeof name !== "string") return null;

  const normalized = stripDiacritics(name.slice(0, MAX_NAME_LENGTH))
    .toLowerCase()
    // Apostrophes are dropped rather than spaced, so `Jerry's` and `Jerrys`
    // agree. Splitting there would make the possessive a separate word and the
    // two spellings different products.
    .replace(/['’ʼ]/g, "")
    // Everything else that is not a letter, digit or space is punctuation
    // noise, and does separate words: `tomato-basil` is two.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

/**
 * The catalogue key for a product identified only by name.
 *
 * @returns the key, or `null` when the name normalizes to nothing — a product
 *   with no usable name has no identity and must not be catalogued.
 */
export function catalogueKeyForName(name: unknown): string | null {
  const normalized = normalizeName(name);
  return normalized === null ? null : `name:${normalized}`;
}

/** The catalogue key for a product that carries a barcode. */
export function catalogueKeyForBarcode(barcode: string): string {
  return `barcode:${barcode}`;
}

/**
 * The catalogue key for an item picked from the produce list.
 *
 * The argument is the item's own `key` from `src/data/produce.ts`, never its
 * display name. That is the whole point: a tomato picked today and a tomato
 * picked after someone rewords the row to "Tomatoes, vine" must land on the
 * same catalogue record, and a key derived from the label could not do that.
 *
 * Prefixed like the other two, so a produce item and a product someone typed
 * the same name for stay distinct. The app cannot know the user meant one
 * thing, and merging them on a guess is not undoable.
 */
export function catalogueKeyForProduce(key: string): string {
  return `produce:${key}`;
}

/**
 * The catalogue key for a product, however it was identified.
 *
 * Barcode wins whenever there is one: two products can share a name, but a
 * barcode is the thing itself.
 */
export function catalogueKeyFor(product: {
  barcode?: string | null;
  name?: unknown;
}): string | null {
  if (typeof product.barcode === "string" && product.barcode.length > 0) {
    return catalogueKeyForBarcode(product.barcode);
  }
  return catalogueKeyForName(product.name);
}
