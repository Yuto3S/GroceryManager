import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PantryProvider } from "../../state/PantryStore";
import { ScanSessionProvider } from "../../state/ScanSessionStore";
import type { Location } from "../../types";
import AddHubScreen from "../AddHubScreen";

// Prefixed `mock` because a jest.mock factory is hoisted above every other
// binding in the file; only names matching /^mock/i may be referenced from it.
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/add",
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const FRIDGE: Location = {
  id: "loc-fridge",
  name: "Fridge",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

const renderHub = () =>
  render(
    <PantryProvider>
      <ScanSessionProvider>
        <AddHubScreen />
      </ScanSessionProvider>
    </PantryProvider>,
  );

beforeEach(async () => {
  await AsyncStorage.setItem(
    "@pantry/locations/v1",
    JSON.stringify({ [FRIDGE.id]: FRIDGE }),
  );
});

describe("AddHubScreen", () => {
  it("offers the produce picker", async () => {
    await renderHub();

    await fireEvent.press(screen.getByTestId("go-produce"));

    expect(mockPush).toHaveBeenCalledWith("/add/produce");
  });

  it("still offers free text", async () => {
    // The picker is an additional path, not a replacement. Anything the list
    // does not cover still has to be enterable.
    await renderHub();

    await fireEvent.press(screen.getByTestId("go-manual-add"));

    expect(mockPush).toHaveBeenCalledWith("/add/manual");
  });

  it("no longer sends loose produce to the text box", async () => {
    // Two options claiming the same job, with the worse one advertised for it,
    // is the failure this copy change exists to remove.
    await renderHub();

    expect(screen.queryByText(/loose fruit and veg/i)).toBeNull();
  });
});
