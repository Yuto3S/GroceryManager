import { describe, expect, it } from "@jest/globals";
import type { Product } from "../../types";
import {
  displayName,
  needsAttention,
  newSession,
  parseSession,
  RESCAN_DEBOUNCE_MS,
  reviewOrder,
  type ScanSession,
  type ScanSessionItem,
  scan,
  sessionItemToAdd,
  sessionReducer,
  sessionToAdds,
} from "../scanSession";

const NOW = new Date(2026, 7, 23, 12, 0).getTime();
const FRIDGE = "loc-fridge";
const FREEZER = "loc-freezer";

const NUTELLA: Product = {
  barcode: "3017620422003",
  name: "Nutella",
  brand: "Ferrero",
  quantity: "400 g",
  imageUrl: null,
  nutriScore: "E",
  category: "Hazelnut spreads",
};

const start = () => newSession("session-1", FRIDGE, NOW);

/** Scan past the debounce window each time, as a person would. */
function scanDeliberately(
  session: ScanSession,
  barcode: string,
  times: number,
): ScanSession {
  let current = session;
  for (let i = 0; i < times; i += 1) {
    current = scan(
      current,
      barcode,
      NOW + i * (RESCAN_DEBOUNCE_MS + 100),
    ).session;
  }
  return current;
}

describe("scan", () => {
  it("queues a new barcode", () => {
    const { session, outcome } = scan(start(), "3017620422003", NOW);

    expect(outcome).toBe("added");
    expect(session.items).toHaveLength(1);
    expect(session.items[0]).toMatchObject({
      barcode: "3017620422003",
      count: 1,
      product: null,
      locationId: FRIDGE,
    });
  });

  it("increments on a deliberate rescan", () => {
    const session = scanDeliberately(start(), "3017620422003", 6);

    expect(session.items).toHaveLength(1);
    expect(session.items[0]?.count).toBe(6);
  });

  it("ignores camera repeats inside the debounce window", () => {
    let session = scan(start(), "3017620422003", NOW).session;
    for (let i = 1; i < 20; i += 1) {
      const result = scan(session, "3017620422003", NOW + i * 30);
      expect(result.outcome).toBe("ignored-duplicate");
      session = result.session;
    }

    expect(session.items[0]?.count).toBe(1);
  });

  it("returns the same session object for an ignored repeat", () => {
    const first = scan(start(), "3017620422003", NOW).session;
    const second = scan(first, "3017620422003", NOW + 10);
    expect(second.session).toBe(first);
  });

  it("counts a scan exactly at the debounce boundary as deliberate", () => {
    const first = scan(start(), "3017620422003", NOW).session;
    const second = scan(first, "3017620422003", NOW + RESCAN_DEBOUNCE_MS);

    expect(second.outcome).toBe("incremented");
    expect(second.session.items[0]?.count).toBe(2);
  });

  it("keeps different barcodes as separate items", () => {
    let session = scan(start(), "3017620422003", NOW).session;
    session = scan(session, "5000112637922", NOW).session;

    expect(session.items).toHaveLength(2);
  });

  it("does not mutate the session it was given", () => {
    const before = start();
    scan(before, "3017620422003", NOW);
    expect(before.items).toHaveLength(0);
  });
});

describe("sessionReducer", () => {
  it("starts an empty session", () => {
    const session = sessionReducer(null, {
      type: "START",
      id: "s1",
      locationId: FRIDGE,
      now: NOW,
    });
    expect(session).toMatchObject({ id: "s1", locationId: FRIDGE, items: [] });
    expect(session?.startedAt).toBe(NOW);
  });

  it("discards to nothing", () => {
    expect(sessionReducer(start(), { type: "DISCARD" })).toBeNull();
  });

  it("ignores scans when there is no session", () => {
    expect(
      sessionReducer(null, { type: "SCAN", barcode: "123", now: NOW }),
    ).toBeNull();
  });

  describe("RESOLVE", () => {
    it("patches the product in place", () => {
      let session = sessionReducer(start(), {
        type: "SCAN",
        barcode: "3017620422003",
        now: NOW,
      });
      session = sessionReducer(session, {
        type: "RESOLVE",
        barcode: "3017620422003",
        product: NUTELLA,
      });

      expect(session?.items[0]?.product).toEqual(NUTELLA);
    });

    it("preserves a count that grew while the lookup was in flight", () => {
      let session: ScanSession | null = scanDeliberately(
        start(),
        "3017620422003",
        4,
      );
      session = sessionReducer(session, {
        type: "RESOLVE",
        barcode: "3017620422003",
        product: NUTELLA,
      });

      expect(session?.items[0]?.count).toBe(4);
      expect(session?.items[0]?.product).toEqual(NUTELLA);
    });

    it("ignores a resolution for a barcode that was dropped", () => {
      const session = sessionReducer(start(), {
        type: "RESOLVE",
        barcode: "3017620422003",
        product: NUTELLA,
      });
      expect(session?.items).toHaveLength(0);
    });
  });

  describe("session location", () => {
    it("applies to items scanned after the change", () => {
      let session = sessionReducer(start(), {
        type: "SCAN",
        barcode: "111",
        now: NOW,
      });
      session = sessionReducer(session, {
        type: "SET_SESSION_LOCATION",
        locationId: FREEZER,
      });
      session = sessionReducer(session, {
        type: "SCAN",
        barcode: "222",
        now: NOW,
      });

      expect(session?.items[0]?.locationId).toBe(FRIDGE);
      expect(session?.items[1]?.locationId).toBe(FREEZER);
    });

    it("does not relabel what was already scanned", () => {
      let session = scanDeliberately(start(), "111", 3);
      session = sessionReducer(session, {
        type: "SET_SESSION_LOCATION",
        locationId: FREEZER,
      }) as ScanSession;

      expect(session.items[0]?.locationId).toBe(FRIDGE);
    });
  });

  describe("DECREMENT_ITEM", () => {
    it("undoes one increment", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 3);
      session = sessionReducer(session, {
        type: "DECREMENT_ITEM",
        barcode: "111",
      });
      expect(session?.items[0]?.count).toBe(2);
    });

    it("removes the item when the only scan is undone", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 1);
      session = sessionReducer(session, {
        type: "DECREMENT_ITEM",
        barcode: "111",
      });

      expect(session?.items).toHaveLength(0);
      // Still a valid session, just an empty one.
      expect(session?.id).toBe("session-1");
    });

    it("ignores an unknown barcode", () => {
      const session = scanDeliberately(start(), "111", 1);
      expect(
        sessionReducer(session, { type: "DECREMENT_ITEM", barcode: "999" }),
      ).toBe(session);
    });
  });

  describe("DROP_ITEM", () => {
    it("removes an item whatever its count", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 6);
      session = sessionReducer(session, { type: "DROP_ITEM", barcode: "111" });
      expect(session?.items).toHaveLength(0);
    });

    it("leaves the others alone", () => {
      let session = scanDeliberately(start(), "111", 2);
      session = scanDeliberately(session, "222", 1);
      const after = sessionReducer(session, {
        type: "DROP_ITEM",
        barcode: "111",
      });

      expect(after?.items.map((i) => i.barcode)).toEqual(["222"]);
    });
  });

  describe("PATCH_ITEM", () => {
    it("edits the count", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 6);
      session = sessionReducer(session, {
        type: "PATCH_ITEM",
        barcode: "111",
        patch: { count: 4 },
      });
      expect(session?.items[0]?.count).toBe(4);
    });

    it("never lets a count fall below one", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 2);
      session = sessionReducer(session, {
        type: "PATCH_ITEM",
        barcode: "111",
        patch: { count: 0 },
      });
      expect(session?.items[0]?.count).toBe(1);
    });

    it("names an unresolved item and keeps its barcode", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 1);
      session = sessionReducer(session, {
        type: "PATCH_ITEM",
        barcode: "111",
        patch: { name: "  Oat milk " },
      });

      expect(session?.items[0]?.name).toBe("Oat milk");
      expect(session?.items[0]?.barcode).toBe("111");
    });

    it("treats a blank name as no name", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 1);
      session = sessionReducer(session, {
        type: "PATCH_ITEM",
        barcode: "111",
        patch: { name: "   " },
      });
      expect(session?.items[0]?.name).toBeNull();
    });

    it("edits unit, step and location", () => {
      let session: ScanSession | null = scanDeliberately(start(), "111", 1);
      session = sessionReducer(session, {
        type: "PATCH_ITEM",
        barcode: "111",
        patch: { unit: "g", step: 125, locationId: FREEZER },
      });

      expect(session?.items[0]).toMatchObject({
        unit: "g",
        step: 125,
        locationId: FREEZER,
      });
    });
  });
});

describe("reviewOrder", () => {
  it("puts items needing a name first", () => {
    let session = scanDeliberately(start(), "resolved", 1);
    session = scanDeliberately(session, "unresolved", 1);
    session = sessionReducer(session, {
      type: "RESOLVE",
      barcode: "resolved",
      product: NUTELLA,
    }) as ScanSession;

    expect(reviewOrder(session).map((i) => i.barcode)).toEqual([
      "unresolved",
      "resolved",
    ]);
  });

  it("orders the rest alphabetically", () => {
    let session = scanDeliberately(start(), "a", 1);
    session = scanDeliberately(session, "b", 1);
    session = sessionReducer(session, {
      type: "RESOLVE",
      barcode: "a",
      product: { ...NUTELLA, name: "Yoghurt" },
    }) as ScanSession;
    session = sessionReducer(session, {
      type: "RESOLVE",
      barcode: "b",
      product: { ...NUTELLA, name: "Apples" },
    }) as ScanSession;

    expect(reviewOrder(session).map((i) => displayName(i))).toEqual([
      "Apples",
      "Yoghurt",
    ]);
  });

  it("stops counting an item as needing attention once it is named", () => {
    let session: ScanSession | null = scanDeliberately(start(), "111", 1);
    expect(needsAttention(session.items[0] as never)).toBe(true);

    session = sessionReducer(session, {
      type: "PATCH_ITEM",
      barcode: "111",
      patch: { name: "Oat milk" },
    });
    expect(needsAttention(session?.items[0] as never)).toBe(false);
  });
});

describe("parseSession", () => {
  it("round-trips a real session through JSON", () => {
    let session = scanDeliberately(start(), "3017620422003", 3);
    session = sessionReducer(session, {
      type: "RESOLVE",
      barcode: "3017620422003",
      product: NUTELLA,
    }) as ScanSession;

    expect(parseSession(JSON.parse(JSON.stringify(session)))).toEqual(session);
  });

  describe("degrades to no session rather than throwing", () => {
    const junk: [string, unknown][] = [
      ["null", null],
      ["undefined", undefined],
      ["an array", []],
      ["a string", "session"],
      ["a number", 7],
      ["an empty object", {}],
      ["a missing id", { startedAt: 1, locationId: "l", items: [] }],
      [
        "a non-numeric startedAt",
        { id: "s", startedAt: "x", locationId: "l", items: [] },
      ],
      [
        "items that are not an array",
        { id: "s", startedAt: 1, locationId: "l", items: {} },
      ],
    ];

    it.each(junk)("returns null for %s", (_label, value) => {
      expect(parseSession(value)).toBeNull();
    });
  });

  it("drops individual items it cannot read, keeping the rest", () => {
    const parsed = parseSession({
      id: "s",
      startedAt: 1,
      locationId: "loc",
      items: [
        null,
        "nope",
        { count: 2 },
        { barcode: "" },
        { barcode: "111", count: 3 },
      ],
    });

    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]).toMatchObject({ barcode: "111", count: 3 });
  });

  it("repairs an unusable count rather than dropping the item", () => {
    const parsed = parseSession({
      id: "s",
      startedAt: 1,
      locationId: "loc",
      items: [{ barcode: "111", count: "many" }],
    });
    expect(parsed?.items[0]?.count).toBe(1);
  });

  it("falls back to the session location for an item that has none", () => {
    const parsed = parseSession({
      id: "s",
      startedAt: 1,
      locationId: "loc-session",
      items: [{ barcode: "111" }],
    });
    expect(parsed?.items[0]?.locationId).toBe("loc-session");
  });

  it("rejects a unit it does not recognise", () => {
    const parsed = parseSession({
      id: "s",
      startedAt: 1,
      locationId: "loc",
      items: [{ barcode: "111", unit: "furlongs" }],
    });
    expect(parsed?.items[0]?.unit).toBeNull();
  });
});

describe("sessionItemToAdd", () => {
  const item = (over: Partial<ScanSessionItem> = {}): ScanSessionItem => ({
    barcode: "3017620422003",
    count: 1,
    product: null,
    name: null,
    locationId: FRIDGE,
    unit: null,
    step: null,
    firstScannedAt: NOW,
    lastScannedAt: NOW,
    ...over,
  });

  it("counts pieces one per scan", () => {
    const add = sessionItemToAdd(
      item({ count: 6, product: { ...NUTELLA, quantity: "6 x 125 g" } }),
      {},
    );
    expect(add).toMatchObject({ unit: "piece", amount: 6, step: 1 });
  });

  it("multiplies a measure by the pack size", () => {
    // Two 400 g jars are 800 g, not "2 g".
    const add = sessionItemToAdd(item({ count: 2, product: NUTELLA }), {});
    expect(add).toMatchObject({ unit: "g", amount: 800, step: 100 });
  });

  it("marks everything in a session as having arrived together", () => {
    expect(sessionItemToAdd(item(), {}).sameSession).toBe(true);
  });

  it("carries the location the item was scanned under", () => {
    expect(sessionItemToAdd(item({ locationId: FREEZER }), {}).locationId).toBe(
      FREEZER,
    );
  });

  it("falls back to one piece for a barcode that never resolved", () => {
    const add = sessionItemToAdd(item(), {});
    expect(add).toMatchObject({ unit: "piece", amount: 1, step: 1 });
    expect(add.product).toMatchObject({ needsName: true });
  });

  it("uses a name typed in review while keeping the barcode identity", () => {
    const add = sessionItemToAdd(item({ name: "Oat milk" }), {});
    expect(add.product).toMatchObject({
      name: "Oat milk",
      needsName: false,
      barcode: "3017620422003",
      key: "barcode:3017620422003",
    });
  });

  it("honours edits made during review over the product's own data", () => {
    const add = sessionItemToAdd(
      item({ count: 3, product: NUTELLA, unit: "piece", step: 2 }),
      {},
    );
    expect(add).toMatchObject({ unit: "piece", amount: 3, step: 2 });
  });

  it("prefers the catalogue's remembered defaults", () => {
    const remembered = {
      id: "barcode:3017620422003",
      key: "barcode:3017620422003",
      barcode: "3017620422003",
      name: "Nutella",
      brand: "Ferrero",
      imageUrl: null,
      nutriScore: "E",
      category: null,
      quantityText: "400 g",
      needsName: false,
      defaultUnit: "g" as const,
      countStep: 1,
      measureStep: 125,
      measureUnit: "g" as const,
      defaultLocationId: FREEZER,
      useCount: 3,
      shelfLifeDays: null,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    };

    const add = sessionItemToAdd(item({ count: 2, product: NUTELLA }), {
      [remembered.key]: remembered,
    });
    expect(add).toMatchObject({ unit: "g", amount: 800, step: 125 });
  });
});

describe("sessionToAdds", () => {
  it("produces one add per item, in review order", () => {
    let session = scanDeliberately(start(), "resolved", 2);
    session = scanDeliberately(session, "unresolved", 1);
    session = sessionReducer(session, {
      type: "RESOLVE",
      barcode: "resolved",
      product: NUTELLA,
    }) as ScanSession;

    const adds = sessionToAdds(session, {});
    expect(adds).toHaveLength(2);
    // Unresolved first — the same order review presents.
    expect(adds[0]?.product.barcode).toBe("unresolved");
  });

  it("produces nothing for an empty session", () => {
    expect(sessionToAdds(start(), {})).toEqual([]);
  });
});
