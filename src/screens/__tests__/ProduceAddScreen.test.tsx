import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";
import { PantryProvider } from "../../state/PantryStore";
import type { Location, PantryEntry } from "../../types";
import ProduceAddScreen from "../ProduceAddScreen";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/add/produce",
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const FRIDGE: Location = {
  id: "loc-fridge",
  name: "Fridge",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

const onDone = jest.fn();
const onCancel = jest.fn();
const onType = jest.fn();

async function seed() {
  await AsyncStorage.setItem(
    "@pantry/locations/v1",
    JSON.stringify({ [FRIDGE.id]: FRIDGE }),
  );
}

const renderScreen = () =>
  render(
    <PantryProvider>
      <ProduceAddScreen onDone={onDone} onCancel={onCancel} onType={onType} />
    </PantryProvider>,
  );

beforeEach(async () => {
  await seed();
});

/**
 * How many host nodes of a given type the tree holds.
 *
 * RNTL v14 dropped `UNSAFE_queryAllByType`, and there is no testID to hang an
 * assertion on for something whose absence is the point.
 */
function countHostNodes(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | null,
  type: string,
): number {
  if (node === null) return 0;
  if (Array.isArray(node)) {
    return node.reduce((n, child) => n + countHostNodes(child, type), 0);
  }
  const here = node.type === type ? 1 : 0;
  const children = (node.children ?? []).filter(
    (child): child is ReactTestRendererJSON => typeof child !== "string",
  );
  return here + children.reduce((n, c) => n + countHostNodes(c, type), 0);
}

/**
 * Narrow to an item, then tap it.
 *
 * The search is not incidental: the list is virtualized, so a row further down
 * than the first screenful does not exist in the tree to be pressed. It is also
 * how anyone would actually reach a specific item.
 */
async function pick(key: string) {
  await fireEvent.changeText(screen.getByTestId("produce-search"), key);
  await fireEvent.press(screen.getByTestId(`produce-${key}`));
}

describe("ProduceAddScreen", () => {
  // Asserted a group at a time rather than all three at once: the list is
  // virtualized, so only the first screenful of rows exists in the tree and a
  // heading further down has legitimately not rendered yet.
  it.each([
    ["carrot", "vegetables"],
    ["apple", "fruit"],
    ["basil", "herbs"],
  ])("files %s under %s", async (query, heading) => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId("produce-search"), query);

    expect(screen.getByTestId(`produce-section-${heading}`)).toBeTruthy();
  });

  it("narrows to what was searched for", async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId("produce-search"), "carrot");

    expect(screen.getByTestId("produce-carrots")).toBeTruthy();
    expect(screen.queryByTestId("produce-apples")).toBeNull();
    // The section a match no longer has must not be left as a bare heading.
    // Asserted on the section header rather than the text "Fruit", which is
    // also a chip label.
    expect(screen.queryByTestId("produce-section-fruit")).toBeNull();
  });

  it("finds an item through the accent the user did not type", async () => {
    await renderScreen();

    await fireEvent.changeText(
      screen.getByTestId("produce-search"),
      "jalapeno",
    );

    expect(screen.getByText("Jalapeños")).toBeTruthy();
  });

  it("offers free text when nothing matches, carrying the query", async () => {
    await renderScreen();

    await fireEvent.changeText(
      screen.getByTestId("produce-search"),
      "stroopwafel",
    );

    expect(screen.getByText("Not on the list")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("produce-type-instead"));

    // The whole point of the handoff: a miss costs a tap, not retyping.
    expect(onType).toHaveBeenCalledWith("stroopwafel");
  });

  it("goes to the add sheet on a tap", async () => {
    await renderScreen();
    await pick("carrots");

    expect(screen.getByTestId("add-confirm")).toBeTruthy();
  });

  it("shows no brand, image or grade for produce", async () => {
    // Produce is a kind of thing, not a package. There is nothing truthful to
    // put in those fields, so the sheet must not invent them.
    await renderScreen();
    await pick("carrots");

    // "E" is Nutella's Nutri-Score in the other fixtures. Produce has no brand,
    // no grade and no packshot, and the sheet must not invent them.
    expect(screen.queryByText("E")).toBeNull();
    expect(screen.getByText("Carrots")).toBeTruthy();
    expect(countHostNodes(screen.toJSON(), "Image")).toBe(0);
  });

  it("creates the entry with no expiry, despite the item having a shelf life", async () => {
    // The produce table carries shelfLifeDays; add-expiry-estimates is what
    // reads it. Nothing here may turn it into a date.
    await renderScreen();
    await pick("carrots");
    await fireEvent.press(screen.getByTestId("add-confirm"));

    const raw = await AsyncStorage.getItem("@pantry/entries/v1");
    const entries = Object.values(
      JSON.parse(raw ?? "{}") as Record<string, PantryEntry>,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.expiresAt).toBeNull();
  });

  it("shows the item's own icon where one exists", async () => {
    await renderScreen();
    await fireEvent.changeText(
      screen.getByTestId("produce-search"),
      "broccoli",
    );

    // `includeHiddenElements` because the icon is deliberately hidden from
    // accessibility: it is decorative, and the tile already carries the name as
    // text. A screen reader announcing "broccoli image, Broccoli" is noise.
    expect(
      screen.getByText("🥦", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("falls back to the group icon rather than a lookalike", async () => {
    // Parsnips have no emoji of their own. Borrowing the carrot would read as
    // the wrong item; the group icon reads as "this kind of thing".
    await renderScreen();
    await fireEvent.changeText(
      screen.getByTestId("produce-search"),
      "parsnips",
    );

    expect(screen.getByTestId("produce-parsnips")).toBeTruthy();
    expect(
      screen.getByText("🥕", { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it("filters to one group from the chip row", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("produce-chip-herbs"));

    expect(screen.getByTestId("produce-section-herbs")).toBeTruthy();
    expect(screen.queryByTestId("produce-section-vegetables")).toBeNull();
    expect(screen.queryByTestId("produce-section-fruit")).toBeNull();
  });

  it("returns to everything when the chip is tapped again", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("produce-chip-herbs"));
    await fireEvent.press(screen.getByTestId("produce-chip-herbs"));

    expect(screen.getByTestId("produce-section-vegetables")).toBeTruthy();
  });

  it("collapses a section but keeps its header and count", async () => {
    // Collapsing must read as "shut", not as "gone" — a section that vanished
    // would leave no way back into it.
    await renderScreen();
    // Artichokes, not Carrots: the list is virtualized, and only the first
    // screenful of rows exists in the tree without a search to narrow it.
    expect(screen.getByTestId("produce-artichokes")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("produce-section-vegetables"));

    expect(screen.queryByTestId("produce-artichokes")).toBeNull();
    expect(screen.getByTestId("produce-section-vegetables")).toBeTruthy();
    expect(screen.getByLabelText(/Vegetables, \d+ items/)).toBeTruthy();
  });

  it("expands a collapsed section again", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("produce-section-vegetables"));
    await fireEvent.press(screen.getByTestId("produce-section-vegetables"));

    expect(screen.getByTestId("produce-artichokes")).toBeTruthy();
  });

  it("shows search results even inside a collapsed section", async () => {
    // Hiding what the user just searched for would read as the search being
    // broken, not as the section being shut.
    await renderScreen();
    await fireEvent.press(screen.getByTestId("produce-section-vegetables"));

    await fireEvent.changeText(screen.getByTestId("produce-search"), "carrots");

    expect(screen.getByTestId("produce-carrots")).toBeTruthy();
  });

  it("shows the item's icon on the add sheet, not an empty box", async () => {
    // The sheet's placeholder glyph is for a product with no picture at all.
    // Produce never has an imageUrl — it is a kind of thing, not a package —
    // so without its own icon every picked item arrived here as a grey box.
    await renderScreen();
    await pick("aubergine");

    expect(
      screen.getByText("🍆", { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.queryByText("▣", { includeHiddenElements: true })).toBeNull();
  });

  it("returns to the grid when the add sheet is cancelled", async () => {
    // Not out of the picker: cancelling one item is not cancelling the search
    // and the section you had open to reach it.
    await renderScreen();
    await pick("carrots");
    expect(screen.getByTestId("add-confirm")).toBeTruthy();

    await fireEvent.press(screen.getByText("Cancel"));

    expect(screen.getByTestId("produce-search")).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("still leaves the picker from its own Cancel", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("produce-cancel"));

    expect(onCancel).toHaveBeenCalled();
  });

  it("catalogues the item under its produce key", async () => {
    await renderScreen();
    await pick("carrots");
    await fireEvent.press(screen.getByTestId("add-confirm"));

    const raw = await AsyncStorage.getItem("@pantry/catalogue/v1");
    expect(Object.keys(JSON.parse(raw ?? "{}"))).toEqual(["produce:carrots"]);
  });
});
