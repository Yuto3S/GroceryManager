// Bounding the offline product cache.

export const MAX_CACHED_PRODUCTS = 300;

/** The only field eviction cares about — see `capCache`. */
interface Cacheable {
  cachedAt?: number;
}

/**
 * Drop the least recently cached products once the cache is over `limit`.
 *
 * Sorts on an explicit `cachedAt` rather than trusting key order. Barcodes are
 * numeric strings, and JS reorders object keys that look like array indices —
 * an 8-digit EAN fits in that range while a 13-digit one doesn't, so insertion
 * order is genuinely not something we can rely on here.
 *
 * `cachedAt` is optional because entries written before it existed are still on
 * people's devices; those sort as oldest and get evicted first.
 *
 * @param cache - barcode -> product.
 * @param limit - how many products to keep.
 * @returns the cache, unchanged (same reference) if it was within limit.
 */
export function capCache<T extends Cacheable>(
  cache: Record<string, T>,
  limit: number = MAX_CACHED_PRODUCTS,
): Record<string, T> {
  const keys = Object.keys(cache);
  if (keys.length <= limit) return cache;

  const next = { ...cache };
  const oldest = keys
    .sort((a, b) => (next[a]?.cachedAt ?? 0) - (next[b]?.cachedAt ?? 0))
    .slice(0, keys.length - limit);
  for (const k of oldest) {
    delete next[k];
  }
  return next;
}
