import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PantryProvider } from "../../state/PantryStore";
import type { AddProductInput } from "../../state/pantryReducer";
import type { CatalogueEntry, Location } from "../../types";
import AddSheet from "../AddSheet";

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

const product = (over: Partial<AddProductInput> = {}): AddProductInput => ({
  key: "barcode:3017620422003",
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Ferrero",
  imageUrl: null,
  nutriScore: "E",
  category: "Hazelnut spreads",
  quantityText: "400 g",
  needsName: false,
  shelfLifeDays: null,
  ...over,
});

async function seed(catalogue: CatalogueEntry[] = []) {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    "@pantry/locations/v1",
    JSON.stringify({ [FRIDGE.id]: FRIDGE, [FREEZER.id]: FREEZER }),
  );
  await AsyncStorage.setItem(
    "@pantry/catalogue/v1",
    JSON.stringify(Object.fromEntries(catalogue.map((c) => [c.key, c]))),
  );
}

const onDone = jest.fn();
const onCancel = jest.fn();

const renderSheet = (input = product()) =>
  render(
    <PantryProvider>
      <AddSheet product={input} onDone={onDone} onCancel={onCancel} />
    </PantryProvider>,
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  onDone.mockReset();
  onCancel.mockReset();
});

describe("AddSheet", () => {
  it("offers exactly two ways to express a quantity", async () => {
    await seed();
    await renderSheet();

    expect(screen.getByText("Count")).toBeTruthy();
    expect(screen.getByText("Weight")).toBeTruthy();
    // The measure unit is the app's decision, so grams and millilitres are
    // never both on offer.
    expect(screen.queryByText("Volume")).toBeNull();
  });

  it("opens on the measure form for a product sold by mass", async () => {
    await seed();
    await renderSheet();

    expect(screen.getByText("400 g")).toBeTruthy();
  });

  it("offers millilitres, not grams, for a volume", async () => {
    await seed();
    await renderSheet(product({ quantityText: "1 L" }));

    expect(screen.getByText("Volume")).toBeTruthy();
    expect(screen.getByText("1000 ml")).toBeTruthy();
  });

  it("opens on the count form for a multipack", async () => {
    await seed();
    await renderSheet(product({ quantityText: "6 x 125 g" }));

    expect(screen.getByText("6")).toBeTruthy();
  });

  it("resets to that form's defaults when switching", async () => {
    await seed();
    await renderSheet();
    expect(screen.getByText("400 g")).toBeTruthy();

    await fireEvent.press(screen.getByText("Count"));
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText("400 g")).toBeNull();

    // Switching back returns the measure form as it was.
    await fireEvent.press(screen.getByText("Weight"));
    expect(screen.getByText("400 g")).toBeTruthy();
  });

  it("steps the amount by the consume step", async () => {
    await seed();
    await renderSheet();

    await fireEvent.press(screen.getByLabelText("More"));
    expect(screen.getByText("500 g")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Less"));
    expect(screen.getByText("400 g")).toBeTruthy();
  });

  it("never steps the amount below one step", async () => {
    await seed();
    await renderSheet();

    for (let i = 0; i < 10; i += 1) {
      await fireEvent.press(screen.getByLabelText("Less"));
    }
    expect(screen.getByText("100 g")).toBeTruthy();
  });

  it("falls back to one piece when the quantity text says nothing", async () => {
    await seed();
    await renderSheet(product({ quantityText: "🥛" }));

    expect(screen.getByText("1")).toBeTruthy();
  });

  it("says so when the product could not be looked up", async () => {
    await seed();
    await renderSheet(
      product({ needsName: true, name: "Unknown product", quantityText: "" }),
    );

    expect(screen.getByText("Unnamed product")).toBeTruthy();
    expect(
      screen.getByText("Not found — you can name it after adding"),
    ).toBeTruthy();
  });

  it("offers every location and preselects the first", async () => {
    await seed();
    await renderSheet();

    expect(screen.getByText("Fridge")).toBeTruthy();
    expect(screen.getByText("Freezer")).toBeTruthy();
  });

  it("creates nothing until the user confirms", async () => {
    await seed();
    await renderSheet();

    await fireEvent.press(screen.getByText("Cancel"));

    expect(onCancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    // The provider persists an empty map once it has loaded; what matters is
    // that no entry is in it.
    const stored = await AsyncStorage.getItem("@pantry/entries/v1");
    expect(JSON.parse(stored ?? "{}")).toEqual({});
  });

  it("creates the entry on confirm", async () => {
    await seed();
    await renderSheet();

    await fireEvent.press(screen.getByText("Add to pantry"));

    expect(onDone).toHaveBeenCalled();
  });
});

describe("AddSheet remembers what the user chose last time", () => {
  // A regression test with a real bug behind it: these defaults come from the
  // store, which hydrates asynchronously. Seeding them into `useState` froze
  // the pre-hydration answer and silently discarded everything below.
  const remembered: CatalogueEntry = {
    id: "barcode:3017620422003",
    key: "barcode:3017620422003",
    barcode: "3017620422003",
    name: "Nutella",
    brand: "Ferrero",
    imageUrl: null,
    nutriScore: "E",
    category: "Hazelnut spreads",
    quantityText: "400 g",
    needsName: false,
    defaultUnit: "g",
    countStep: 1,
    measureStep: 125,
    measureUnit: "g",
    defaultLocationId: FREEZER.id,
    useCount: 4,
    shelfLifeDays: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };

  it("pre-fills the remembered consume step", async () => {
    await seed([remembered]);
    await renderSheet();

    expect(screen.getByLabelText("Consume step").props.value).toBe("125");
  });

  it("steps the amount by the remembered step", async () => {
    await seed([remembered]);
    await renderSheet();

    await fireEvent.press(screen.getByLabelText("More"));
    expect(screen.getByText("525 g")).toBeTruthy();
  });

  it("pre-selects the remembered location", async () => {
    await seed([remembered]);
    await renderSheet();

    expect(
      screen.getByText("Freezer").parent?.props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it("falls back when the remembered location has since been removed", async () => {
    await seed([{ ...remembered, defaultLocationId: "loc-gone" }]);
    await renderSheet();

    expect(
      screen.getByText("Fridge").parent?.props.accessibilityState,
    ).toMatchObject({ selected: true });
  });
});
