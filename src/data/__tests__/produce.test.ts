import { describe, expect, it } from "@jest/globals";
import { PRODUCE, PRODUCE_GROUPS } from "../produce";

describe("the produce table", () => {
  it("has a unique key for every item", () => {
    const keys = PRODUCE.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no empty key or name", () => {
    for (const item of PRODUCE) {
      expect(item.key.length).toBeGreaterThan(0);
      expect(item.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("puts every item in a group the picker renders", () => {
    for (const item of PRODUCE) {
      expect(PRODUCE_GROUPS).toContain(item.group);
    }
  });

  it("keys on a slug, not on the display name", () => {
    // Not style policing. The key is the catalogue identity, so a key that
    // merely looks like the name invites someone to "tidy" it when the name is
    // reworded — which would orphan every entry already added under it.
    for (const item of PRODUCE) {
      expect(item.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("gives every item a usable shelf life", () => {
    // add-expiry-estimates depends on this being complete, and the whole point
    // of populating it during curation is that it never becomes half-filled.
    for (const item of PRODUCE) {
      expect(Number.isInteger(item.shelfLifeDays)).toBe(true);
      expect(item.shelfLifeDays).toBeGreaterThan(0);
    }
  });

  it("records where every item came from", () => {
    for (const item of PRODUCE) {
      expect(Number.isInteger(item.source)).toBe(true);
      expect(item.source).toBeGreaterThan(0);
    }
  });

  it("carries every group, so no section is defined but unreachable", () => {
    for (const group of PRODUCE_GROUPS) {
      expect(PRODUCE.some((item) => item.group === group)).toBe(true);
    }
  });

  it("is big enough to be worth picking from", () => {
    expect(PRODUCE.length).toBeGreaterThanOrEqual(100);
  });
});
