import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReadResult, WriteResult } from "../../lib/backupFile";
import { PantryProvider } from "../../state/PantryStore";
import type { CatalogueEntry, Location, PantryEntry } from "../../types";
import BackupScreen from "../BackupScreen";

// The platform I/O is the one thing that cannot run here — it is the fork over
// `Platform.OS`, the share sheet and the file picker. Everything the screen
// actually decides sits above it, and that is what these tests are about.
jest.mock("../../lib/backupFile", () => ({
  canExport: jest.fn(async () => true),
  writeBackupFile: jest.fn(async () => ({ kind: "delivered" })),
  readBackupFile: jest.fn(async () => ({ kind: "cancelled" })),
}));

const io = jest.requireMock("../../lib/backupFile") as {
  canExport: jest.Mock<() => Promise<boolean>>;
  writeBackupFile: jest.Mock<
    (json: string, filename: string) => Promise<WriteResult>
  >;
  readBackupFile: jest.Mock<() => Promise<ReadResult>>;
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const FRIDGE: Location = {
  id: "loc-fridge",
  name: "Fridge",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

const record = (over: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  id: "k",
  key: "k",
  barcode: null,
  name: "Milk",
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
});

const entry = (over: Partial<PantryEntry> = {}): PantryEntry => ({
  id: "e1",
  productKey: "k",
  amount: 2,
  unit: "piece",
  step: 1,
  locationId: FRIDGE.id,
  expiresAt: null,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  ...over,
});

async function seed(
  entries: PantryEntry[] = [entry()],
  catalogue: CatalogueEntry[] = [record()],
  locations: Location[] = [FRIDGE],
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

const renderScreen = () =>
  render(
    <PantryProvider>
      <BackupScreen onDone={() => {}} />
    </PantryProvider>,
  );

/** A backup document as a string, ready to be handed to the picker. */
function backupText(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: "grocery-scanner.pantry",
    version: 1,
    exportedAt: Date.now(),
    entries: {
      "restored-1": {
        id: "restored-1",
        productKey: "k:beans",
        amount: 5,
        unit: "piece",
        step: 1,
        locationId: "loc-cellar",
        expiresAt: null,
        createdAt: 10,
        updatedAt: 20,
        deletedAt: null,
      },
    },
    catalogue: {
      "k:beans": record({ id: "k:beans", key: "k:beans", name: "Beans" }),
    },
    locations: {
      "loc-cellar": { ...FRIDGE, id: "loc-cellar", name: "Cellar" },
    },
    ...over,
  });
}

/** Hand the picker a file, then tap through to the confirmation. */
async function choose(text: string, name = "pantry-backup.json") {
  io.readBackupFile.mockResolvedValueOnce({ kind: "read", text, name });
  await fireEvent.press(screen.getByText("Choose a backup file…"));
}

beforeEach(async () => {
  await AsyncStorage.clear();
  io.canExport.mockResolvedValue(true);
  io.writeBackupFile.mockResolvedValue({ kind: "delivered" });
  io.readBackupFile.mockResolvedValue({ kind: "cancelled" });
});

describe("what is stored now", () => {
  it("states the current counts", async () => {
    await seed();
    await renderScreen();
    expect(
      await screen.findByText(
        "1 item in the pantry, 1 product in the catalogue, 1 place.",
      ),
    ).toBeTruthy();
  });

  it("does not count out-of-stock entries as items in the pantry", async () => {
    await seed([entry({ amount: 0 })]);
    await renderScreen();
    expect(
      await screen.findByText(
        "0 items in the pantry, 1 product in the catalogue, 1 place.",
      ),
    ).toBeTruthy();
  });
});

describe("export", () => {
  it("writes a backup containing the pantry", async () => {
    await seed();
    await renderScreen();
    await fireEvent.press(await screen.findByText("Export a backup"));

    await waitFor(() => expect(io.writeBackupFile).toHaveBeenCalled());
    const [json, filename] = io.writeBackupFile.mock.calls[0] ?? [];
    expect(filename).toMatch(/^pantry-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    const parsed = JSON.parse(String(json));
    expect(parsed.format).toBe("grocery-scanner.pantry");
    expect(Object.keys(parsed.entries)).toEqual(["e1"]);
    expect(parsed.productCache).toBeUndefined();
  });

  it("hides the control rather than offering one that does nothing", async () => {
    io.canExport.mockResolvedValue(false);
    await seed();
    await renderScreen();
    expect(
      await screen.findByText(/This device has no way to save or send a file/),
    ).toBeTruthy();
    expect(screen.queryByText("Export a backup")).toBeNull();
  });

  it("reports a failure to deliver", async () => {
    io.writeBackupFile.mockResolvedValue({
      kind: "failed",
      message: "no disk",
    });
    await seed();
    await renderScreen();
    await fireEvent.press(await screen.findByText("Export a backup"));
    expect(await screen.findByText("no disk")).toBeTruthy();
  });
});

describe("import — rejection", () => {
  it("refuses a file that is not JSON and leaves the pantry alone", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose("this is not json", "notes.txt");

    expect(
      await screen.findByText(/notes\.txt is not a backup file/),
    ).toBeTruthy();
    expect(screen.getByText("Your pantry has not been changed.")).toBeTruthy();
    expect(
      screen.getByText(
        "1 item in the pantry, 1 product in the catalogue, 1 place.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Replace everything")).toBeNull();
  });

  it("refuses JSON that is not a pantry backup", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(JSON.stringify({ entries: {} }), "other.json");
    expect(
      await screen.findByText(
        /other\.json is a JSON file, but not a pantry backup/,
      ),
    ).toBeTruthy();
  });

  it("refuses a backup from a newer format version, naming both", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText({ version: 99 }));
    expect(
      await screen.findByText(
        /newer version of the app \(format 99; this version understands 1\)/,
      ),
    ).toBeTruthy();
  });

  it("reports a file it could not read at all", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    io.readBackupFile.mockResolvedValueOnce({
      kind: "unreadable",
      message: "permission denied",
    });
    await fireEvent.press(screen.getByText("Choose a backup file…"));
    expect(
      await screen.findByText(/That file could not be read: permission denied/),
    ).toBeTruthy();
  });

  it("does nothing at all when the picker is cancelled", async () => {
    await seed();
    await renderScreen();
    await fireEvent.press(await screen.findByText("Choose a backup file…"));
    expect(screen.queryByText("Replace your pantry?")).toBeNull();
    expect(screen.queryByText(/could not be read/)).toBeNull();
  });
});

describe("import — confirmation", () => {
  it("states what the backup holds and what will be lost", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText());

    expect(await screen.findByText("Replace your pantry?")).toBeTruthy();
    expect(screen.getByText(/It holds 1 entry and 1 product\./)).toBeTruthy();
    expect(
      screen.getByText(
        "Restoring will delete the 1 item and 1 product on this device.",
      ),
    ).toBeTruthy();
  });

  it("says how old the backup is", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    const threeDaysAgo = Date.now() - 3 * 86_400_000;
    await choose(backupText({ exportedAt: threeDaysAgo }));
    expect(await screen.findByText(/was made 3 days ago/)).toBeTruthy();
  });

  it("changes nothing until the user confirms", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText());
    await screen.findByText("Replace your pantry?");

    // The counts panel still describes the device's own pantry.
    expect(
      screen.getByText(
        "1 item in the pantry, 1 product in the catalogue, 1 place.",
      ),
    ).toBeTruthy();
  });

  it("leaves the pantry alone when the user declines", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText());
    await fireEvent.press(await screen.findByText("Keep what I have"));

    expect(screen.queryByText("Replace your pantry?")).toBeNull();
    expect(
      screen.getByText(
        "1 item in the pantry, 1 product in the catalogue, 1 place.",
      ),
    ).toBeTruthy();
  });

  it("warns up front about records it could not read", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(
      backupText({
        entries: {
          good: { ...entry({ id: "good", productKey: "k:beans" }) },
          bad: { ...entry({ id: "bad", productKey: "k:beans" }), unit: "kg" },
        },
      }),
    );
    expect(
      await screen.findByText(/1 record in this file could not be read/),
    ).toBeTruthy();
  });
});

describe("import — restoring", () => {
  it("replaces the pantry and reports what was restored", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText());
    await fireEvent.press(await screen.findByText("Replace everything"));

    expect(await screen.findByText("Restored")).toBeTruthy();
    expect(screen.getByText("1 entry, 1 product and 1 place.")).toBeTruthy();
    // The restored entry holds 5 pieces, but the panel counts entries, not
    // units — one lot of beans is one item in the pantry.
    expect(
      screen.getByText(
        "1 item in the pantry, 1 product in the catalogue, 1 place.",
      ),
    ).toBeTruthy();
  });

  it("persists the restored pantry", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText());
    await fireEvent.press(await screen.findByText("Replace everything"));
    await screen.findByText("Restored");

    await waitFor(async () => {
      const stored = await AsyncStorage.getItem("@pantry/entries/v1");
      expect(JSON.parse(stored ?? "{}")).toHaveProperty("restored-1");
    });
  });

  it("shows a repair rather than doing it silently", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(
      backupText({
        entries: {
          "restored-1": {
            ...entry({ id: "restored-1", productKey: "k:beans" }),
            locationId: "loc-that-is-gone",
          },
        },
      }),
    );
    await fireEvent.press(await screen.findByText("Replace everything"));
    expect(
      await screen.findByText(
        /1 entry moved to another place, because the original was missing\./,
      ),
    ).toBeTruthy();
  });

  it("reports an entry dropped for want of a product", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText({ catalogue: {} }));
    await fireEvent.press(await screen.findByText("Replace everything"));
    expect(
      await screen.findByText(
        /1 entry had no matching product and was dropped\./,
      ),
    ).toBeTruthy();
  });

  it("says when it had to create the default places", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText({ locations: {} }));
    await fireEvent.press(await screen.findByText("Replace everything"));
    expect(
      await screen.findByText(
        "The backup had no places, so the default ones were created.",
      ),
    ).toBeTruthy();
  });

  it("reports nothing extra on a clean import", async () => {
    await seed();
    await renderScreen();
    await screen.findByText("Choose a backup file…");
    await choose(backupText());
    await fireEvent.press(await screen.findByText("Replace everything"));
    await screen.findByText("Restored");

    expect(screen.queryByText(/could not be read/)).toBeNull();
    expect(screen.queryByText(/moved to another place/)).toBeNull();
    expect(screen.queryByText(/were created/)).toBeNull();
  });
});
