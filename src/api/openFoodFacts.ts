// Open Food Facts product lookup.
// Free, open database of grocery products (great coverage in Germany / Rewe items).
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

import type { Product } from "../types";

// OFF asks every app to identify itself with a User-Agent. Put your own app
// name + a contact here once you publish.
const USER_AGENT = "GroceryScanner/0.1 (personal project)";

// Give up on a lookup rather than leaving the scan screen spinning forever.
const TIMEOUT_MS = 10000;

// Open Food Facts is community-editable, so the response is `unknown` until
// every field we touch has been checked. These two helpers are that check —
// a type annotation on `res.json()` would be an assertion, not a guarantee.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Non-strings become "", so a vandalized record can't reach the UI as-is. */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Image URLs get rendered by <Image>, so only allow plain https —
// http:// would be cleartext, and file:// / data: could point at local files.
function safeImageUrl(url: unknown): string | null {
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
 *
 * @param barcode - the digits from the scanned barcode.
 * @returns a normalized product, or null if it isn't in the database.
 */
export async function lookupProduct(barcode: string): Promise<Product | null> {
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

    const data: unknown = await res.json();

    // status 0 means "product not in the database".
    if (!isRecord(data) || data.status === 0 || !isRecord(data.product)) {
      return null;
    }

    const p = data.product;
    const grade = asString(p.nutriscore_grade).toUpperCase();

    return {
      barcode: asString(p.code) || barcode,
      name: asString(p.product_name).trim() || "Unknown product",
      brand: (asString(p.brands).split(",")[0] ?? "").trim(),
      quantity: asString(p.quantity).trim(),
      imageUrl: safeImageUrl(p.image_front_small_url),
      nutriScore: grade || null,
    };
  } catch (e) {
    // `strict` types a caught value as `unknown`, which is the truth — a
    // rejected fetch can throw anything.
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("The lookup timed out. Check your connection.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
