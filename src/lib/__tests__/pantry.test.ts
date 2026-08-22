import { describe, expect, it } from "@jest/globals";
import type { PantryEntry } from "../../types";
import {
  consume,
  isOutOfStock,
  isVisible,
  remove,
  restock,
  setAmount,
} from "../pantry";

const NOW = 1_756_000_000_000;
const EARLIER = NOW - 86_400_000;

const entry = (over: Partial<PantryEntry> = {}): PantryEntry => ({
  id: "entry-1",
  productKey: "barcode:3017620422003",
  amount: 4,
  unit: "piece",
  step: 1,
  locationId: "loc-fridge",
  expiresAt: null,
  createdAt: EARLIER,
  updatedAt: EARLIER,
  deletedAt: null,
  ...over,
});

describe("consume", () => {
  it("removes one step", () => {
    expect(consume(entry({ amount: 4, step: 1 }), NOW).amount).toBe(3);
  });

  it("removes a bulk step", () => {
    expect(
      consume(entry({ amount: 1000, step: 100, unit: "g" }), NOW).amount,
    ).toBe(900);
  });

  it("clamps at zero rather than going negative", () => {
    // The last scoop is always smaller than the step.
    expect(
      consume(entry({ amount: 50, step: 100, unit: "g" }), NOW).amount,
    ).toBe(0);
  });

  it("consuming the last unit takes the entry out of stock", () => {
    const emptied = consume(entry({ amount: 1, step: 1 }), NOW);
    expect(isOutOfStock(emptied)).toBe(true);
    expect(isVisible(emptied)).toBe(false);
  });

  it("does not delete the entry when it empties", () => {
    // It is the purchase history; later features read it.
    expect(consume(entry({ amount: 1, step: 1 }), NOW).deletedAt).toBeNull();
  });

  it("stamps updatedAt", () => {
    expect(consume(entry(), NOW).updatedAt).toBe(NOW);
  });

  it("does not mutate its argument", () => {
    const original = entry({ amount: 4 });
    consume(original, NOW);
    expect(original.amount).toBe(4);
    expect(original.updatedAt).toBe(EARLIER);
  });

  it("stays at zero when consumed again", () => {
    expect(consume(entry({ amount: 0, step: 1 }), NOW).amount).toBe(0);
  });
});

describe("restock", () => {
  it("adds to the amount", () => {
    expect(restock(entry({ amount: 2 }), 3, NOW).amount).toBe(5);
  });

  it("brings a hidden out-of-stock entry back into view", () => {
    const hidden = entry({ amount: 0 });
    expect(isVisible(hidden)).toBe(false);

    const revived = restock(hidden, 2, NOW);
    expect(revived.amount).toBe(2);
    expect(isVisible(revived)).toBe(true);
    expect(isOutOfStock(revived)).toBe(false);
  });

  it("ignores a negative addition rather than subtracting", () => {
    expect(restock(entry({ amount: 2 }), -5, NOW).amount).toBe(2);
  });

  it("survives a non-finite amount", () => {
    expect(restock(entry({ amount: 2 }), Number.NaN, NOW).amount).toBe(2);
    expect(
      restock(entry({ amount: 2 }), Number.POSITIVE_INFINITY, NOW).amount,
    ).toBe(2);
  });

  it("stamps updatedAt", () => {
    expect(restock(entry(), 1, NOW).updatedAt).toBe(NOW);
  });
});

describe("setAmount", () => {
  it("sets the amount outright", () => {
    expect(setAmount(entry({ amount: 4 }), 9, NOW).amount).toBe(9);
  });

  it("clamps a negative amount to zero", () => {
    expect(setAmount(entry(), -3, NOW).amount).toBe(0);
  });

  it("rounds to a whole amount", () => {
    expect(setAmount(entry(), 2.6, NOW).amount).toBe(3);
  });
});

describe("remove", () => {
  it("tombstones rather than dropping the record", () => {
    const removed = remove(entry({ amount: 400, unit: "g" }), NOW);
    expect(removed.deletedAt).toBe(NOW);
    expect(removed.amount).toBe(400);
  });

  it("hides the entry whatever is left of it", () => {
    expect(isVisible(remove(entry({ amount: 400 }), NOW))).toBe(false);
  });

  it("is distinguishable from having been consumed to zero", () => {
    // Removing says "I got rid of it"; zero says "I finished it".
    const removed = remove(entry({ amount: 400 }), NOW);
    const finished = consume(entry({ amount: 1, step: 1 }), NOW);

    expect(removed.deletedAt).not.toBeNull();
    expect(finished.deletedAt).toBeNull();
    expect(isOutOfStock(removed)).toBe(false);
    expect(isOutOfStock(finished)).toBe(true);
  });
});

describe("isVisible", () => {
  it("is true only for a stocked, un-removed entry", () => {
    expect(isVisible(entry({ amount: 1 }))).toBe(true);
    expect(isVisible(entry({ amount: 0 }))).toBe(false);
    expect(isVisible(entry({ amount: 1, deletedAt: NOW }))).toBe(false);
    expect(isVisible(entry({ amount: 0, deletedAt: NOW }))).toBe(false);
  });
});
