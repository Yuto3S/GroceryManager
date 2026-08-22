// Open Food Facts product lookup.
// Free, open database of grocery products (great coverage in Germany / Rewe items).
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

// OFF asks every app to identify itself with a User-Agent. Put your own app
// name + a contact here once you publish.
const USER_AGENT = "GroceryScanner/0.1 (personal project)";

// Give up on a lookup rather than leaving the scan screen spinning forever.
const TIMEOUT_MS = 10000;

// Open Food Facts is community-editable, so every field below is untrusted
// input. Image URLs get rendered by <Image>, so only allow plain https —
// http:// would be cleartext, and file:// / data: could point at local files.
function safeImageUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https:\/\//i.test(trimmed) ? trimmed : null;
}

// We only request the fields we actually use — keeps responses small and fast.
const FIELDS = [
  "code",
  "product_name",
  "brands",
  "quantity",
  "image_front_small_url",
  "nutriscore_grade",
  "categories",
].join(",");

/**
 * Look up a product by its barcode number (EAN / UPC / GTIN).
 * @param {string} barcode - the digits from the scanned barcode.
 * @returns {Promise<null | {
 *   barcode: string,
 *   name: string,
 *   brand: string,
 *   quantity: string,
 *   imageUrl: string | null,
 *   nutriScore: string | null,
 * }>} normalized product, or null if not found.
 */
export async function lookupProduct(barcode) {
  // Callers should already have extracted the digits; refuse anything else so
  // we never forward arbitrary scanned text to a third-party server.
  if (!/^\d{8,14}$/.test(barcode)) return null;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=${FIELDS}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Open Food Facts request failed (${res.status})`);
    }

    const data = await res.json();

    // status 0 means "product not in the database".
    if (!data || data.status === 0 || !data.product) {
      return null;
    }

    const p = data.product;
    return {
      barcode: p.code || barcode,
      name: (p.product_name || "").trim() || "Unknown product",
      brand: (p.brands || "").split(",")[0].trim(),
      quantity: (p.quantity || "").trim(),
      imageUrl: safeImageUrl(p.image_front_small_url),
      nutriScore: p.nutriscore_grade ? p.nutriscore_grade.toUpperCase() : null,
    };
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("The lookup timed out. Check your connection.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
