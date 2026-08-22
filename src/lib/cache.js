// Bounding the offline product cache.

export const MAX_CACHED_PRODUCTS = 300;

/**
 * Drop the least recently cached products once the cache is over `limit`.
 *
 * Sorts on an explicit `cachedAt` rather than trusting key order. Barcodes are
 * numeric strings, and JS reorders object keys that look like array indices —
 * an 8-digit EAN fits in that range while a 13-digit one doesn't, so insertion
 * order is genuinely not something we can rely on here.
 *
 * @param {Record<string, object>} cache - barcode -> product.
 * @param {number} [limit] - how many products to keep.
 * @returns {Record<string, object>} the cache, unchanged if it was within limit.
 */
export function capCache(cache, limit = MAX_CACHED_PRODUCTS) {
  const keys = Object.keys(cache);
  if (keys.length <= limit) return cache;

  const next = { ...cache };
  keys
    .sort((a, b) => (next[a]?.cachedAt ?? 0) - (next[b]?.cachedAt ?? 0))
    .slice(0, keys.length - limit)
    .forEach((k) => delete next[k]);
  return next;
}
