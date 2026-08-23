import { describe, expect, it } from "@jest/globals";
import {
  catalogueKeyFor,
  catalogueKeyForBarcode,
  catalogueKeyForName,
  catalogueKeyForProduce,
  normalizeName,
} from "../identity";

describe("normalizeName", () => {
  it("ignores case", () => {
    expect(normalizeName("Bread")).toBe(normalizeName("bread"));
  });

  it("ignores surrounding whitespace", () => {
    expect(normalizeName("bread ")).toBe(normalizeName("bread"));
    expect(normalizeName("\t bread \n")).toBe("bread");
  });

  it("collapses whitespace inside the name", () => {
    expect(normalizeName("olive   oil")).toBe("olive oil");
    expect(normalizeName("olive\toil")).toBe("olive oil");
  });

  it("ignores accents", () => {
    expect(normalizeName("Crème Fraîche")).toBe("creme fraiche");
    expect(normalizeName("Jalapeño")).toBe(normalizeName("jalapeno"));
  });

  it("ignores punctuation", () => {
    expect(normalizeName("Ben & Jerry's")).toBe("ben jerrys");
    // The possessive apostrophe must not split the word, or the two obvious
    // spellings of the same product become two products.
    expect(normalizeName("Ben & Jerry's")).toBe(normalizeName("ben jerrys"));
    expect(normalizeName("Jerry\u2019s")).toBe(normalizeName("Jerrys"));
    // Other punctuation does separate words.
    expect(normalizeName("tomato-basil")).toBe("tomato basil");
  });

  it("keeps digits, which are part of real product names", () => {
    expect(normalizeName("Milk 1.5%")).toBe("milk 1 5");
  });

  it("returns null when nothing usable is left", () => {
    for (const input of ["", "   ", "!!!", "-", null, undefined, 42, {}, []]) {
      expect(normalizeName(input)).toBeNull();
    }
  });

  it("does not throw on a very long name", () => {
    expect(() => normalizeName("a".repeat(10_000))).not.toThrow();
    expect(normalizeName("a".repeat(10_000))).toHaveLength(120);
  });
});

describe("catalogueKeyForName", () => {
  it("gives the same key for the same name typed differently", () => {
    expect(catalogueKeyForName("Bread")).toBe(catalogueKeyForName("bread "));
  });

  it("gives different keys for different names", () => {
    expect(catalogueKeyForName("bread")).not.toBe(
      catalogueKeyForName("butter"),
    );
  });

  it("is null for an unusable name", () => {
    expect(catalogueKeyForName("  ")).toBeNull();
  });

  it("cannot collide with a barcode key", () => {
    // A user typing digits as a name must not land on a real product's record.
    expect(catalogueKeyForName("12345678")).not.toBe(
      catalogueKeyForBarcode("12345678"),
    );
  });
});

describe("catalogueKeyFor", () => {
  it("prefers the barcode when there is one", () => {
    expect(catalogueKeyFor({ barcode: "3017620422003", name: "Nutella" })).toBe(
      catalogueKeyForBarcode("3017620422003"),
    );
  });

  it("does not let the name affect a barcoded product's key", () => {
    const a = catalogueKeyFor({ barcode: "3017620422003", name: "Nutella" });
    const b = catalogueKeyFor({ barcode: "3017620422003", name: "hazelnut" });
    expect(a).toBe(b);
  });

  it("falls back to the name when there is no barcode", () => {
    expect(catalogueKeyFor({ barcode: null, name: "Tomato" })).toBe(
      catalogueKeyForName("tomato"),
    );
  });

  it("is null when there is neither", () => {
    expect(catalogueKeyFor({ barcode: null, name: "" })).toBeNull();
    expect(catalogueKeyFor({})).toBeNull();
  });
});

describe("catalogueKeyForProduce", () => {
  it("prefixes, so produce cannot collide with a barcode or a typed name", () => {
    expect(catalogueKeyForProduce("tomatoes")).toBe("produce:tomatoes");
    expect(catalogueKeyForProduce("tomatoes")).not.toBe(
      catalogueKeyForName("tomatoes"),
    );
    expect(catalogueKeyForProduce("3017620422003")).not.toBe(
      catalogueKeyForBarcode("3017620422003"),
    );
  });

  it("is independent of the display name", () => {
    // The rename-safety the whole scheme rests on: an item's label is editable
    // copy, and rewording it must not orphan the entries already added under
    // it. Only the slug is identity.
    const before = { key: "tomatoes", name: "Tomatoes" };
    const after = { key: "tomatoes", name: "Tomatoes, vine" };

    expect(catalogueKeyForProduce(after.key)).toBe(
      catalogueKeyForProduce(before.key),
    );
  });

  it("keeps two different items apart", () => {
    expect(catalogueKeyForProduce("tomatoes")).not.toBe(
      catalogueKeyForProduce("cherry-tomatoes"),
    );
  });
});
