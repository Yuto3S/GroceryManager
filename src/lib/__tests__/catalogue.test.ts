import { describe, expect, it } from "@jest/globals";
import type { CatalogueEntry } from "../../types";
import { addDefaultsFor, orderCatalogue, searchCatalogue } from "../catalogue";

function record(over: Partial<CatalogueEntry> = {}): CatalogueEntry {
  const key = over.key ?? "k";
  return {
    id: key,
    key,
    barcode: null,
    name: "Product",
    brand: "",
    imageUrl: null,
    nutriScore: null,
    category: null,
    quantityText: "",
    needsName: false,
    defaultUnit: "piece",
    countStep: 1,
    measureStep: 100,
    measureUnit: "g",
    defaultLocationId: null,
    useCount: 1,
    shelfLifeDays: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...over,
  };
}

const catalogue = (records: CatalogueEntry[]) =>
  Object.fromEntries(records.map((r) => [r.key, r]));

describe("orderCatalogue", () => {
  it("puts the most-used products first", () => {
    const ordered = orderCatalogue(
      catalogue([
        record({ key: "a", name: "Rarely", useCount: 1 }),
        record({ key: "b", name: "Often", useCount: 12 }),
        record({ key: "c", name: "Sometimes", useCount: 4 }),
      ]),
    );
    expect(ordered.map((r) => r.name)).toEqual([
      "Often",
      "Sometimes",
      "Rarely",
    ]);
  });

  it("breaks ties alphabetically so the list does not reshuffle", () => {
    const ordered = orderCatalogue(
      catalogue([
        record({ key: "a", name: "Yoghurt", useCount: 1 }),
        record({ key: "b", name: "Apples", useCount: 1 }),
      ]),
    );
    expect(ordered.map((r) => r.name)).toEqual(["Apples", "Yoghurt"]);
  });

  it("omits tombstoned records", () => {
    const ordered = orderCatalogue(
      catalogue([
        record({ key: "a", name: "Gone", deletedAt: 1 }),
        record({ key: "b", name: "Here" }),
      ]),
    );
    expect(ordered.map((r) => r.name)).toEqual(["Here"]);
  });

  it("is empty for an empty catalogue", () => {
    expect(orderCatalogue({})).toEqual([]);
  });
});

describe("searchCatalogue", () => {
  const shelf = catalogue([
    record({ key: "a", name: "Crème fraîche", useCount: 3 }),
    record({ key: "b", name: "Milk", brand: "Berchtesgadener", useCount: 9 }),
    record({ key: "c", name: "Spaghetti", useCount: 1 }),
  ]);

  it("matches without the accents the user did not type", () => {
    expect(searchCatalogue(shelf, "creme").map((r) => r.name)).toEqual([
      "Crème fraîche",
    ]);
  });

  it("ignores case", () => {
    expect(searchCatalogue(shelf, "SPAG").map((r) => r.name)).toEqual([
      "Spaghetti",
    ]);
  });

  it("matches on the brand too", () => {
    expect(searchCatalogue(shelf, "berchtes").map((r) => r.name)).toEqual([
      "Milk",
    ]);
  });

  it("keeps the most-used-first ordering", () => {
    expect(searchCatalogue(shelf, "").map((r) => r.name)).toEqual([
      "Milk",
      "Crème fraîche",
      "Spaghetti",
    ]);
  });

  it("returns everything for a query that says nothing", () => {
    for (const query of ["", "   ", null, undefined, 42, {}]) {
      expect(searchCatalogue(shelf, query)).toHaveLength(3);
    }
  });

  it("returns nothing when there is no match", () => {
    expect(searchCatalogue(shelf, "zzzz")).toEqual([]);
  });
});

describe("addDefaultsFor", () => {
  it("derives a measure form from the product's own text", () => {
    expect(addDefaultsFor(null, "500 g")).toMatchObject({
      unit: "g",
      measureUnit: "g",
      measureAmount: 500,
      measureStep: 100,
    });
  });

  it("still fills in the count form the user might switch to", () => {
    expect(addDefaultsFor(null, "500 g")).toMatchObject({
      countAmount: 1,
      countStep: 1,
    });
  });

  it("derives a count form from a multipack", () => {
    expect(addDefaultsFor(null, "6 x 125 g")).toMatchObject({
      unit: "piece",
      countAmount: 6,
      countStep: 1,
    });
  });

  it("uses millilitres for a volume", () => {
    expect(addDefaultsFor(null, "1 L")).toMatchObject({
      unit: "ml",
      measureUnit: "ml",
      measureAmount: 1000,
    });
  });

  it("falls back to one piece when the text says nothing", () => {
    expect(addDefaultsFor(null, "")).toMatchObject({
      unit: "piece",
      countAmount: 1,
      countStep: 1,
      measureUnit: "g",
    });
  });

  it("survives untrusted quantity text", () => {
    for (const text of [null, undefined, 42, {}, "🥛"]) {
      expect(() => addDefaultsFor(null, text)).not.toThrow();
      expect(addDefaultsFor(null, text).unit).toBe("piece");
    }
  });

  it("prefers what the user chose last time over the product's own text", () => {
    const remembered = record({
      key: "a",
      defaultUnit: "g",
      measureStep: 125,
      countStep: 2,
      measureUnit: "g",
      defaultLocationId: "loc-freezer",
    });
    expect(addDefaultsFor(remembered, "6 x 125 g")).toMatchObject({
      unit: "g",
      measureStep: 125,
      countStep: 2,
      locationId: "loc-freezer",
    });
  });

  it("keeps the amount from the product text even when steps are remembered", () => {
    const remembered = record({ key: "a", defaultUnit: "g", measureStep: 125 });
    expect(addDefaultsFor(remembered, "750 g").measureAmount).toBe(750);
  });
});

describe("addDefaultsFor, for produce", () => {
  // Produce supplies no quantity text — it is a kind of thing, not a package —
  // so the sheet has to fall back exactly as it does for a typed name.
  it("opens a first-time produce item on one piece with a step of one", () => {
    const defaults = addDefaultsFor(null, "");

    expect(defaults.unit).toBe("piece");
    expect(defaults.countAmount).toBe(1);
    expect(defaults.countStep).toBe(1);
    expect(defaults.locationId).toBeNull();
  });

  it("picks up what the user chose the first time", () => {
    const defaults = addDefaultsFor(
      record({
        key: "produce:carrots",
        defaultUnit: "g",
        measureUnit: "g",
        countStep: 2,
        measureStep: 50,
        defaultLocationId: "loc-fridge",
      }),
      "",
    );

    expect(defaults.unit).toBe("g");
    expect(defaults.countStep).toBe(2);
    expect(defaults.measureStep).toBe(50);
    expect(defaults.locationId).toBe("loc-fridge");
  });
});
