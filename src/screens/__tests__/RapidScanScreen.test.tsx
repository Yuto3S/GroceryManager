import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { lookupProduct } from "../../api/openFoodFacts";
import { PantryProvider } from "../../state/PantryStore";
import { ScanSessionProvider } from "../../state/ScanSessionStore";
import { RESCAN_DEBOUNCE_MS } from "../../state/scanSession";
import type { Location, Product } from "../../types";
import RapidScanScreen from "../RapidScanScreen";
import ScanReviewScreen from "../ScanReviewScreen";

jest.mock("../../api/openFoodFacts", () => ({ lookupProduct: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/add/rapid",
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const lookup = jest.mocked(lookupProduct);

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

const NUTELLA: Product = {
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Ferrero",
  quantity: "400 g",
  imageUrl: null,
  nutriScore: "E",
  category: "Hazelnut spreads",
};

/**
 * Scanning and reviewing are separate routes sharing one provider, so the test
 * harness swaps between them the way navigation would.
 */
function Harness() {
  const [reviewing, setReviewing] = useState(false);
  return (
    <PantryProvider>
      <ScanSessionProvider>
        {reviewing ? (
          <ScanReviewScreen
            onDone={() => setReviewing(false)}
            onBack={() => setReviewing(false)}
          />
        ) : (
          <RapidScanScreen
            onReview={() => setReviewing(true)}
            onCancel={() => {}}
          />
        )}
        <View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setReviewing((r) => !r)}
          >
            <Text>toggle-review</Text>
          </TouchableOpacity>
        </View>
      </ScanSessionProvider>
    </PantryProvider>
  );
}

/** Simulate the camera decoding a value. */
const scan = (data: string) =>
  fireEvent(screen.getByTestId("camera"), "touchEnd", {
    nativeEvent: { data },
  });

let clock = 0;
const advance = (ms: number) => {
  clock += ms;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    "@pantry/locations/v1",
    JSON.stringify({ [FRIDGE.id]: FRIDGE, [FREEZER.id]: FREEZER }),
  );
  lookup.mockReset();
  lookup.mockResolvedValue(null);

  clock = new Date(2026, 7, 23, 12, 0).getTime();
  jest.spyOn(Date, "now").mockImplementation(() => clock);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("RapidScanScreen", () => {
  it("queues a scanned barcode straight away", async () => {
    await render(<Harness />);

    await scan("3017620422003");

    expect(await screen.findByText(/1 product/)).toBeTruthy();
  });

  it("shows the incremented count on a deliberate rescan", async () => {
    lookup.mockResolvedValue(NUTELLA);
    await render(<Harness />);

    await scan("3017620422003");
    advance(RESCAN_DEBOUNCE_MS + 100);
    await scan("3017620422003");

    // One product, scanned twice.
    expect(await screen.findByText(/1 product · 2 scanned/)).toBeTruthy();
    expect(screen.getByText(/×2/)).toBeTruthy();
  });

  it("offers an undo for an increment", async () => {
    await render(<Harness />);

    await scan("3017620422003");
    advance(RESCAN_DEBOUNCE_MS + 100);
    await scan("3017620422003");

    await screen.findByText(/1 product · 2 scanned/);
    await fireEvent.press(screen.getByLabelText("Undo that increase"));

    expect(await screen.findByText(/1 product · 1 scanned/)).toBeTruthy();
  });

  it("ignores camera repeats inside the debounce window", async () => {
    await render(<Harness />);

    await scan("3017620422003");
    advance(30);
    await scan("3017620422003");
    advance(30);
    await scan("3017620422003");

    expect(await screen.findByText(/1 product · 1 scanned/)).toBeTruthy();
  });

  it("makes no request for a decoded value with no product number", async () => {
    await render(<Harness />);

    await scan("https://example.com/hello");

    expect(await screen.findByText("Not a product barcode")).toBeTruthy();
    expect(lookup).not.toHaveBeenCalled();
    expect(screen.getByText("Nothing scanned yet")).toBeTruthy();
  });

  it("does not let a slow lookup block the next scan", async () => {
    // The scan path has no `await` in it; this is what that buys.
    // Held in an object so TypeScript does not narrow the binding to `never`
    // from the assignment inside the executor.
    const pending: { settle?: (p: Product | null) => void } = {};
    lookup.mockImplementation(
      () =>
        new Promise<Product | null>((resolve) => {
          pending.settle = resolve;
        }),
    );

    await render(<Harness />);

    await scan("3017620422003");
    advance(RESCAN_DEBOUNCE_MS + 100);
    await scan("5000112637922");

    // Both queued while the first lookup is still in flight.
    expect(await screen.findByText(/2 products · 2 scanned/)).toBeTruthy();

    pending.settle?.(NUTELLA);
  });

  it("keeps scanning with no network at all", async () => {
    lookup.mockRejectedValue(new Error("offline"));
    await render(<Harness />);

    await scan("3017620422003");
    advance(RESCAN_DEBOUNCE_MS + 100);
    await scan("5000112637922");

    expect(await screen.findByText(/2 products · 2 scanned/)).toBeTruthy();
  });

  it("scans into the session location and can change it", async () => {
    await render(<Harness />);

    expect(await screen.findByText("Scanning into Fridge")).toBeTruthy();
    await fireEvent.press(screen.getByText("Freezer"));
    expect(await screen.findByText("Scanning into Freezer")).toBeTruthy();
  });
});

describe("the session survives the app being killed", () => {
  it("persists as it grows", async () => {
    await render(<Harness />);

    await scan("3017620422003");
    advance(RESCAN_DEBOUNCE_MS + 100);
    await scan("5000112637922");

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem("@pantry/scanSession/v1");
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw ?? "{}").items).toHaveLength(2);
    });
  });
});

describe("review", () => {
  it("takes unresolved items through to review", async () => {
    lookup.mockResolvedValue(null);
    await render(<Harness />);

    await scan("3017620422003");
    await screen.findByText(/1 product/);
    await fireEvent.press(screen.getByText("Review 1"));

    expect(
      await screen.findByText("1 needs a name — they're first."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Name for 3017620422003")).toBeTruthy();
  });

  it("creates nothing until confirmed", async () => {
    await render(<Harness />);

    await scan("3017620422003");
    await screen.findByText(/1 product/);
    await fireEvent.press(screen.getByText("Review 1"));
    await screen.findByText("Add 1 to pantry");

    const entries = await AsyncStorage.getItem("@pantry/entries/v1");
    expect(JSON.parse(entries ?? "{}")).toEqual({});
  });

  it("creates entries on confirmation and clears the session", async () => {
    lookup.mockResolvedValue(NUTELLA);
    await render(<Harness />);

    await scan("3017620422003");
    await screen.findByText(/1 product/);
    await fireEvent.press(screen.getByText("Review 1"));
    await fireEvent.press(await screen.findByText("Add 1 to pantry"));

    await waitFor(async () => {
      const entries = JSON.parse(
        (await AsyncStorage.getItem("@pantry/entries/v1")) ?? "{}",
      );
      expect(Object.keys(entries)).toHaveLength(1);
    });

    await waitFor(async () => {
      expect(await AsyncStorage.getItem("@pantry/scanSession/v1")).toBeNull();
    });
  });

  it("drops an item without touching the others", async () => {
    await render(<Harness />);

    await scan("3017620422003");
    advance(RESCAN_DEBOUNCE_MS + 100);
    await scan("5000112637922");
    await screen.findByText(/2 products/);
    await fireEvent.press(screen.getByText("Review 2"));

    await screen.findByText("Add 2 to pantry");
    await fireEvent.press(screen.getByLabelText("Remove 3017620422003"));

    expect(await screen.findByText("Add 1 to pantry")).toBeTruthy();
  });
});
