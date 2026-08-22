import { describe, expect, it } from "@jest/globals";
import type { CatalogueEntry, Location, PantryEntry } from "../../types";
import {
  groupPantry,
  OTHER_CATEGORY,
  otherCategoryShare,
  UNNAMED_PRODUCT,
} from "../grouping";

const FRIDGE: Location = {
  id: "loc-fridge",
  name: "Fridge",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};
const FREEZER: Location = {
  ...FRIDGE,
  id: "loc-freezer",
  name: "Freezer",
  createdAt: 2,
};
const CUPBOARD: Location = {
  ...FRIDGE,
  id: "loc-cupboard",
  name: "Cupboard",
  createdAt: 3,
};
const LOCATIONS = [FRIDGE, FREEZER, CUPBOARD];

let seq = 0;
function entry(over: Partial<PantryEntry> = {}): PantryEntry {
  seq += 1;
  return {
    id: `entry-${seq}`,
    productKey: `name:product-${seq}`,
    amount: 1,
    unit: "piece",
    step: 1,
    locationId: FRIDGE.id,
    expiresAt: null,
    createdAt: seq,
    updatedAt: seq,
    deletedAt: null,
    ...over,
  };
}

function record(over: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    id: "k",
    key: "k",
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

/** Build the two maps from a list of [name, category, overrides] triples. */
function pantry(
  items: [name: string, category: string | null, over?: Partial<PantryEntry>][],
) {
  const entries: Record<string, PantryEntry> = {};
  const catalogue: Record<string, CatalogueEntry> = {};
  items.forEach(([name, category, over], i) => {
    const key = `name:${name.toLowerCase()}-${i}`;
    const e = entry({ productKey: key, ...over });
    entries[e.id] = e;
    catalogue[key] = record({ id: key, key, name, category });
  });
  return { entries, catalogue };
}

describe("groupPantry by location", () => {
  it("groups under location headings", () => {
    const { entries, catalogue } = pantry([
      ["Milk", null, { locationId: FRIDGE.id }],
      ["Peas", null, { locationId: FREEZER.id }],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "location");

    expect(groups.map((g) => g.title)).toEqual(["Fridge", "Freezer"]);
  });

  it("sorts alphabetically within a group", () => {
    const { entries, catalogue } = pantry([
      ["Yoghurt", null],
      ["Apples", null],
      ["Milk", null],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "location");

    expect(groups[0]?.rows.map((r) => r.name)).toEqual([
      "Apples",
      "Milk",
      "Yoghurt",
    ]);
  });

  it("keeps the locations in the order they were created", () => {
    const { entries, catalogue } = pantry([
      ["Rice", null, { locationId: CUPBOARD.id }],
      ["Milk", null, { locationId: FRIDGE.id }],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "location");

    expect(groups.map((g) => g.title)).toEqual(["Fridge", "Cupboard"]);
  });

  it("does not render a location with nothing visible in it", () => {
    const { entries, catalogue } = pantry([
      ["Milk", null, { locationId: FRIDGE.id }],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "location");

    expect(groups).toHaveLength(1);
    expect(groups.map((g) => g.title)).not.toContain("Freezer");
  });

  it("hides out-of-stock and removed entries", () => {
    const { entries, catalogue } = pantry([
      ["Milk", null],
      ["Butter", null, { amount: 0 }],
      ["Cheese", null, { deletedAt: 5 }],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "location");

    expect(groups[0]?.rows.map((r) => r.name)).toEqual(["Milk"]);
  });

  it("is empty when nothing is in stock", () => {
    const { entries, catalogue } = pantry([["Milk", null, { amount: 0 }]]);
    expect(groupPantry(entries, catalogue, LOCATIONS, "location")).toEqual([]);
  });

  it("keeps two rows of the same product distinguishable by creation order", () => {
    const key = "name:milk";
    const older = entry({ productKey: key, createdAt: 10 });
    const newer = entry({ productKey: key, createdAt: 20 });
    const groups = groupPantry(
      { [older.id]: older, [newer.id]: newer },
      { [key]: record({ id: key, key, name: "Milk" }) },
      LOCATIONS,
      "location",
    );

    expect(groups[0]?.rows.map((r) => r.entry.id)).toEqual([
      older.id,
      newer.id,
    ]);
  });

  it("labels an entry whose product has never been named", () => {
    const key = "barcode:123";
    const e = entry({ productKey: key });
    const groups = groupPantry(
      { [e.id]: e },
      {
        [key]: record({
          id: key,
          key,
          name: "Unknown product",
          needsName: true,
        }),
      },
      LOCATIONS,
      "location",
    );

    expect(groups[0]?.rows[0]?.name).toBe(UNNAMED_PRODUCT);
  });

  it("survives an entry whose catalogue record is missing", () => {
    const e = entry({ productKey: "name:gone" });
    const groups = groupPantry({ [e.id]: e }, {}, LOCATIONS, "location");

    expect(groups[0]?.rows[0]?.name).toBe(UNNAMED_PRODUCT);
    expect(groups[0]?.rows[0]?.product).toBeNull();
  });
});

describe("groupPantry by category", () => {
  it("groups by the derived category", () => {
    const { entries, catalogue } = pantry([
      ["Milk", "Dairies"],
      ["Spaghetti", "Pasta"],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "category");

    expect(groups.map((g) => g.title)).toEqual(["Dairies", "Pasta"]);
  });

  it("puts everything with no category under one Other group", () => {
    const { entries, catalogue } = pantry([
      ["Milk", "Dairies"],
      ["Tomato", null],
      ["Onion", null],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "category");

    const other = groups.find((g) => g.title === OTHER_CATEGORY);
    expect(other?.rows.map((r) => r.name)).toEqual(["Onion", "Tomato"]);
  });

  it("sorts Other last however the alphabet falls", () => {
    const { entries, catalogue } = pantry([
      ["Tomato", null],
      ["Yoghurt", "Zzz dairy"],
      ["Bread", "Breads"],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "category");

    expect(groups.map((g) => g.title)).toEqual([
      "Breads",
      "Zzz dairy",
      OTHER_CATEGORY,
    ]);
  });

  it("ignores location entirely", () => {
    const { entries, catalogue } = pantry([
      ["Milk", "Dairies", { locationId: FRIDGE.id }],
      ["Cream", "Dairies", { locationId: FREEZER.id }],
    ]);
    const groups = groupPantry(entries, catalogue, LOCATIONS, "category");

    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(2);
  });
});

describe("otherCategoryShare", () => {
  it("is zero for an empty pantry", () => {
    expect(otherCategoryShare({}, {})).toBe(0);
  });

  it("measures the share with no derivable category", () => {
    const { entries, catalogue } = pantry([
      ["Milk", "Dairies"],
      ["Tomato", null],
      ["Onion", null],
      ["Bread", "Breads"],
    ]);
    expect(otherCategoryShare(entries, catalogue)).toBe(0.5);
  });

  it("counts only what is visible", () => {
    const { entries, catalogue } = pantry([
      ["Milk", "Dairies"],
      ["Tomato", null, { amount: 0 }],
    ]);
    expect(otherCategoryShare(entries, catalogue)).toBe(0);
  });
});
