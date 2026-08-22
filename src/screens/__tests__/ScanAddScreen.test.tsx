import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { lookupProduct } from "../../api/openFoodFacts";
import { PantryProvider } from "../../state/PantryStore";
import type { Location, Product } from "../../types";
import ScanAddScreen from "../ScanAddScreen";

// The network is the thing under test here only in the sense that its failures
// must not stop an entry being created; the request itself is not.
jest.mock("../../api/openFoodFacts", () => ({
  lookupProduct: jest.fn(),
}));

const lookup = jest.mocked(lookupProduct);

const FRIDGE: Location = {
  id: "loc-fridge",
  name: "Fridge",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

const NUTELLA: Product = {
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Ferrero",
  quantity: "400 g",
  imageUrl: null,
  nutriScore: "E",
  category: "Hazelnut spreads",
};

const onDone = jest.fn();
const onCancel = jest.fn();

const renderScan = () =>
  render(
    <PantryProvider>
      <ScanAddScreen onDone={onDone} onCancel={onCancel} />
    </PantryProvider>,
  );

/** Simulate the camera decoding a value. */
const scan = (data: string) =>
  fireEvent(screen.getByTestId("camera"), "touchEnd", {
    nativeEvent: { data },
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    "@pantry/locations/v1",
    JSON.stringify({ [FRIDGE.id]: FRIDGE }),
  );
  lookup.mockReset();
  onDone.mockReset();
  onCancel.mockReset();
});

describe("ScanAddScreen", () => {
  it("looks a scanned barcode up and lands on the add sheet", async () => {
    lookup.mockResolvedValue(NUTELLA);
    await renderScan();

    await scan("3017620422003");

    expect(await screen.findByText("Nutella")).toBeTruthy();
    expect(screen.getByText("Add to pantry")).toBeTruthy();
    expect(lookup).toHaveBeenCalledWith("3017620422003");
    // The camera calls back many times a second while a barcode is in view;
    // one scan must still mean one request. The latch that guarantees that is
    // also what "stops scanning once it has a result" below observes.
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("pre-fills the sheet from the product's own quantity", async () => {
    lookup.mockResolvedValue(NUTELLA);
    await renderScan();

    await scan("3017620422003");

    expect(await screen.findByText("400 g")).toBeTruthy();
  });

  it("reads a GS1 Digital Link QR code", async () => {
    lookup.mockResolvedValue(NUTELLA);
    await renderScan();

    await scan("https://example.com/01/3017620422003/10/LOT99");

    expect(await screen.findByText("Nutella")).toBeTruthy();
    expect(lookup).toHaveBeenCalledWith("3017620422003");
  });

  it("still lets the entry be created when the product is unknown", async () => {
    lookup.mockResolvedValue(null);
    await renderScan();

    await scan("3017620422003");

    expect(await screen.findByText("Unnamed product")).toBeTruthy();
    expect(
      screen.getByText("Not in the database — add it and name it yourself."),
    ).toBeTruthy();
    expect(screen.getByText("Add to pantry")).toBeTruthy();
  });

  it("still lets the entry be created when the lookup fails", async () => {
    // Offline, or a timeout. The user is holding the thing either way.
    lookup.mockRejectedValue(new Error("The lookup timed out."));
    await renderScan();

    await scan("3017620422003");

    expect(await screen.findByText("Unnamed product")).toBeTruthy();
    expect(
      screen.getByText("Couldn't reach the database — you can name it later."),
    ).toBeTruthy();
    expect(screen.getByText("Add to pantry")).toBeTruthy();
  });

  it("makes no request for a code that holds no product number", async () => {
    await renderScan();

    await scan("https://example.com/hello");

    expect(await screen.findByText("Not a product barcode")).toBeTruthy();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("stops scanning once it has a result", async () => {
    lookup.mockResolvedValue(NUTELLA);
    await renderScan();

    await scan("3017620422003");

    await screen.findByText("Nutella");
    expect(screen.queryByTestId("camera")).toBeNull();
  });

  it("can scan again after a code that was not a product", async () => {
    await renderScan();

    await scan("https://example.com/hello");
    await screen.findByText("Not a product barcode");

    lookup.mockResolvedValue(NUTELLA);
    await fireEvent.press(screen.getByText("Scan again"));

    await scan("3017620422003");
    expect(await screen.findByText("Nutella")).toBeTruthy();
  });
});
