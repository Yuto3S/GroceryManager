import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { PantryProvider } from "../../state/PantryStore";
import type { CatalogueEntry, Location, PantryEntry } from "../../types";
import PantryScreen from "../PantryScreen";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

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

function record(over: Partial<CatalogueEntry>): CatalogueEntry {
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

function entry(over: Partial<PantryEntry>): PantryEntry {
  const id = over.id ?? "e";
  return {
    id,
    productKey: "k",
    amount: 1,
    unit: "piece",
    step: 1,
    locationId: FRIDGE.id,
    expiresAt: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...over,
  };
}

/** Put a pantry on the device, the way a previous session would have left it. */
async function seed(
  entries: PantryEntry[],
  catalogue: CatalogueEntry[],
  locations: Location[] = [FRIDGE, FREEZER],
) {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    "@pantry/entries/v1",
    JSON.stringify(Object.fromEntries(entries.map((e) => [e.id, e]))),
  );
  await AsyncStorage.setItem(
    "@pantry/catalogue/v1",
    JSON.stringify(Object.fromEntries(catalogue.map((c) => [c.key, c]))),
  );
  await AsyncStorage.setItem(
    "@pantry/locations/v1",
    JSON.stringify(Object.fromEntries(locations.map((l) => [l.id, l]))),
  );
}

// `render` and `fireEvent` are async in @testing-library/react-native v14 —
// React 19 made `act` async, and the whole API followed. Forgetting an `await`
// does not fail loudly; it leaves `screen` unset and every query reports
// "`render` function has not been called".
const renderPantry = () =>
  render(
    <PantryProvider>
      <PantryScreen />
    </PantryProvider>,
  );

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("PantryScreen", () => {
  it("says so plainly when there is nothing in the pantry", async () => {
    await renderPantry();
    expect(await screen.findByText("Nothing in the pantry yet")).toBeTruthy();
  });

  it("groups entries under their location headings", async () => {
    await seed(
      [
        entry({ id: "e1", productKey: "k:milk", locationId: FRIDGE.id }),
        entry({ id: "e2", productKey: "k:peas", locationId: FREEZER.id }),
      ],
      [
        record({ key: "k:milk", name: "Milk" }),
        record({ key: "k:peas", name: "Peas" }),
      ],
    );
    await renderPantry();

    expect(await screen.findByText("Fridge")).toBeTruthy();
    expect(screen.getByText("Freezer")).toBeTruthy();
    expect(screen.getByText("Milk")).toBeTruthy();
    expect(screen.getByText("Peas")).toBeTruthy();
  });

  it("orders entries alphabetically within a group", async () => {
    await seed(
      [
        entry({ id: "e1", productKey: "k:y" }),
        entry({ id: "e2", productKey: "k:a" }),
        entry({ id: "e3", productKey: "k:m" }),
      ],
      [
        record({ key: "k:y", name: "Yoghurt" }),
        record({ key: "k:a", name: "Apples" }),
        record({ key: "k:m", name: "Milk" }),
      ],
    );
    await renderPantry();

    await screen.findByText("Apples");
    const names = screen
      .getAllByText(/Apples|Milk|Yoghurt/)
      .map((node) => node.props.children);
    expect(names).toEqual(["Apples", "Milk", "Yoghurt"]);
  });

  it("does not render a location with nothing in it", async () => {
    await seed(
      [entry({ id: "e1", productKey: "k:milk", locationId: FRIDGE.id })],
      [record({ key: "k:milk", name: "Milk" })],
    );
    await renderPantry();

    await screen.findByText("Fridge");
    expect(screen.queryByText("Freezer")).toBeNull();
  });

  it("hides a row once it is consumed to zero", async () => {
    await seed(
      [entry({ id: "e1", productKey: "k:milk", amount: 1, step: 1 })],
      [record({ key: "k:milk", name: "Milk" })],
    );
    await renderPantry();

    await screen.findByText("Milk");
    await fireEvent.press(screen.getByLabelText("Use some Milk"));

    await waitFor(() => expect(screen.queryByText("Milk")).toBeNull());
    // Hidden, not deleted — the empty pantry message is what is left.
    expect(screen.getByText("Nothing in the pantry yet")).toBeTruthy();
  });

  it("decrements by the entry's step rather than by one", async () => {
    await seed(
      [
        entry({
          id: "e1",
          productKey: "k:rice",
          amount: 1000,
          step: 100,
          unit: "g",
        }),
      ],
      [record({ key: "k:rice", name: "Rice" })],
    );
    await renderPantry();

    await screen.findByText("Rice");
    expect(screen.getByText("1000 g")).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Use some Rice"));
    expect(await screen.findByText("900 g")).toBeTruthy();
  });

  it("switches to grouping by category", async () => {
    await seed(
      [
        entry({ id: "e1", productKey: "k:milk", locationId: FRIDGE.id }),
        entry({ id: "e2", productKey: "k:peas", locationId: FREEZER.id }),
      ],
      [
        record({ key: "k:milk", name: "Milk", category: "Dairies" }),
        record({ key: "k:peas", name: "Peas", category: null }),
      ],
    );
    await renderPantry();

    await screen.findByText("Fridge");
    await fireEvent.press(screen.getByText("By category"));

    expect(await screen.findByText("Dairies")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
    expect(screen.queryByText("Fridge")).toBeNull();
  });

  it("shows two rows for two lots of the same product", async () => {
    await seed(
      [
        entry({ id: "e1", productKey: "k:milk", createdAt: 10 }),
        entry({ id: "e2", productKey: "k:milk", createdAt: 20 }),
      ],
      [record({ key: "k:milk", name: "Milk" })],
    );
    await renderPantry();

    await screen.findAllByText("Milk");
    expect(screen.getAllByText("Milk")).toHaveLength(2);
  });

  it("offers both places and backup from the header", async () => {
    await renderPantry();
    expect(await screen.findByText("Places")).toBeTruthy();
    expect(screen.getByText("Backup")).toBeTruthy();
  });
});
