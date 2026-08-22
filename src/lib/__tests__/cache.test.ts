import { describe, expect, it } from "@jest/globals";
import { capCache, MAX_CACHED_PRODUCTS } from "../cache";

const at = (cachedAt: number) => ({ cachedAt });

describe("capCache", () => {
  it("leaves a cache that's within the limit untouched", () => {
    const cache = { 3017620422003: at(1), 40084015: at(2) };
    expect(capCache(cache, 5)).toBe(cache); // same reference, no copy
  });

  it("evicts the oldest entries once over the limit", () => {
    const cache = {
      1111111111111: at(300),
      2222222222222: at(100),
      3333333333333: at(200),
    };
    expect(Object.keys(capCache(cache, 2)).sort()).toEqual([
      "1111111111111",
      "3333333333333",
    ]);
  });

  it("does not mutate the cache it was given", () => {
    const cache = { 1111111111111: at(2), 2222222222222: at(1) };
    capCache(cache, 1);
    expect(Object.keys(cache)).toHaveLength(2);
  });

  it("evicts by cachedAt, not by key order", () => {
    // "40084015" fits in the array-index range so JS hoists it to the front of
    // Object.keys, while the 13-digit codes stay in insertion order. Eviction
    // must ignore that and follow cachedAt: the 8-digit one is newest and stays.
    const cache = {
      9999999999999: at(10), // oldest
      40084015: at(30), // newest, but sorts first by key
      8888888888888: at(20),
    };
    const kept = capCache(cache, 2);
    expect(kept["40084015"]).toBeDefined();
    expect(kept["9999999999999"]).toBeUndefined();
  });

  it("treats a missing cachedAt as oldest", () => {
    const cache: Record<string, { cachedAt?: number }> = {
      1111111111111: {}, // legacy entry written before cachedAt existed
      2222222222222: at(5),
    };
    expect(Object.keys(capCache(cache, 1))).toEqual(["2222222222222"]);
  });

  it("defaults to MAX_CACHED_PRODUCTS", () => {
    const cache: Record<string, { cachedAt: number }> = {};
    for (let i = 0; i < MAX_CACHED_PRODUCTS + 10; i++) {
      cache[`999${String(i).padStart(10, "0")}`] = at(i);
    }
    expect(Object.keys(capCache(cache))).toHaveLength(MAX_CACHED_PRODUCTS);
  });
});
