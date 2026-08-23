import { describe, expect, it } from "@jest/globals";
import type { ProduceItem } from "../../data/produce";
import { PRODUCE, PRODUCE_GROUPS } from "../../data/produce";
import {
  gridRows,
  groupProduce,
  produceByKey,
  produceForCatalogueKey,
  searchProduce,
} from "../produce";

const item = (over: Partial<ProduceItem> = {}): ProduceItem => ({
  key: "carrots",
  name: "Carrots",
  emoji: "🥕",
  group: "Vegetables",
  shelfLifeDays: 21,
  source: 279,
  ...over,
});

describe("groupProduce", () => {
  it("returns the groups in the order the picker declares", () => {
    const sections = groupProduce();
    expect(sections.map((s) => s.group)).toEqual([...PRODUCE_GROUPS]);
  });

  it("produces identical output on two calls", () => {
    // A picker that reshuffles between visits is one you cannot build muscle
    // memory for, which is most of what makes it faster than typing.
    expect(groupProduce()).toEqual(groupProduce());
  });

  it("sorts items by name within a group", () => {
    const [vegetables] = groupProduce();
    const names = vegetables?.items.map((i) => i.name) ?? [];
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("drops a group with nothing in it rather than heading empty space", () => {
    const sections = groupProduce([item({ group: "Fruit", name: "Apples" })]);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.group).toBe("Fruit");
  });

  it("keeps every item in the table", () => {
    const total = groupProduce().reduce((n, s) => n + s.items.length, 0);
    expect(total).toBe(PRODUCE.length);
  });
});

describe("searchProduce", () => {
  it("ignores the accent the user did not type", () => {
    const names = searchProduce("jalapeno").map((i) => i.name);
    expect(names).toContain("Jalapeños");
  });

  it("ignores capitalisation", () => {
    expect(searchProduce("CARROTS").map((i) => i.key)).toContain("carrots");
  });

  it("matches on part of a name", () => {
    expect(searchProduce("berr").map((i) => i.key)).toEqual(
      expect.arrayContaining(["blackberries", "blueberries", "strawberries"]),
    );
  });

  it("returns everything for a query with nothing usable in it", () => {
    // Punctuation and whitespace normalize to nothing. Showing an empty picker
    // for a stray keystroke would look broken.
    expect(searchProduce("   ")).toHaveLength(PRODUCE.length);
    expect(searchProduce("!!!")).toHaveLength(PRODUCE.length);
    expect(searchProduce(null)).toHaveLength(PRODUCE.length);
  });

  it("returns nothing when nothing matches", () => {
    // Distinct from the unusable-query case above: this really is a miss, and
    // the screen offers to add it by hand.
    expect(searchProduce("stroopwafel")).toHaveLength(0);
  });

  it("sections a search result without empty headings", () => {
    const sections = groupProduce(searchProduce("jalapeno"));
    expect(sections.map((s) => s.group)).toEqual(["Vegetables"]);
  });
});

describe("produceByKey", () => {
  it("finds an item by its stable key", () => {
    expect(produceByKey("tomatoes")?.name).toBe("Tomatoes");
  });

  it("returns null for a key that is not in the table", () => {
    expect(produceByKey("unobtainium")).toBeNull();
  });
});

describe("gridRows", () => {
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => item({ key: `k${i}`, name: `N${i}` }));

  it("splits items into rows of the given width", () => {
    const rows = gridRows(items(6), 3);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(3);
  });

  it("leaves a short last row short", () => {
    // Nothing pads it: a tile is a fixed proportion of the row rather than an
    // equal share of it, so a last row of one renders one normal-width tile
    // instead of stretching across the screen.
    const rows = gridRows(items(4), 3);
    expect(rows[1]?.map((c) => c.key)).toEqual(["k3"]);
  });

  it("keeps every item, in order", () => {
    const flat = gridRows(items(7), 3).flat();
    expect(flat.map((c) => c.key)).toEqual([
      "k0",
      "k1",
      "k2",
      "k3",
      "k4",
      "k5",
      "k6",
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(gridRows([], 3)).toEqual([]);
  });

  it("refuses a nonsense column count rather than looping forever", () => {
    expect(gridRows(items(3), 0)).toEqual([]);
  });
});

describe("produceForCatalogueKey", () => {
  it("recovers the item behind a produce catalogue key", () => {
    expect(produceForCatalogueKey("produce:carrots")?.name).toBe("Carrots");
  });

  it("ignores keys from the other add paths", () => {
    expect(produceForCatalogueKey("name:carrots")).toBeNull();
    expect(produceForCatalogueKey("barcode:3017620422003")).toBeNull();
  });

  it("survives anything that is not a string", () => {
    expect(produceForCatalogueKey(undefined)).toBeNull();
    expect(produceForCatalogueKey(42)).toBeNull();
  });
});
