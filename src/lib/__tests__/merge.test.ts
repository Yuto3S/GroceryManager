import { describe, expect, it } from "@jest/globals";
import {
  decideMerge,
  LONG_LIFE_DAYS,
  type MergeSource,
  type MergeTarget,
  shouldMerge,
} from "../merge";

// Local wall-clock times, built from components so these do not shift with the
// machine's timezone. `new Date("2026-08-27")` would parse as UTC midnight and
// render as the 26th anywhere west of Greenwich — the exact off-by-one the
// storage format exists to prevent.
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const source = (over: Partial<MergeSource> = {}): MergeSource => ({
  productKey: "barcode:3017620422003",
  shelfLifeDays: null,
  expiresAt: null,
  ...over,
});

const target = (over: Partial<MergeTarget> = {}): MergeTarget => ({
  productKey: "barcode:3017620422003",
  createdAt: at(2026, 8, 22),
  expiresAt: null,
  ...over,
});

describe("decideMerge", () => {
  it("never merges different products", () => {
    const decision = decideMerge(
      source({ productKey: "barcode:1111111111111" }),
      target(),
      at(2026, 8, 22),
    );
    expect(decision).toEqual({ merge: false, reason: "different-product" });
  });

  it("does not merge different products even on the same day", () => {
    expect(
      shouldMerge(
        source({ productKey: "name:bread" }),
        target({ productKey: "name:butter", createdAt: at(2026, 8, 22, 9) }),
        at(2026, 8, 22, 17),
      ),
    ).toBe(false);
  });

  describe("clause 1 — arrived together", () => {
    it("merges within the same add session", () => {
      // Explicitly a different day, so only the session flag can be doing it.
      const decision = decideMerge(
        source({ sameSession: true, expiresAt: "2026-08-30" }),
        target({ createdAt: at(2026, 8, 1), expiresAt: "2026-08-05" }),
        at(2026, 8, 22),
      );
      expect(decision).toEqual({ merge: true, reason: "arrived-together" });
    });

    it("merges on the same calendar day across different sessions", () => {
      const decision = decideMerge(
        source({ expiresAt: "2026-08-30" }),
        target({ createdAt: at(2026, 8, 22, 8, 15), expiresAt: "2026-08-24" }),
        at(2026, 8, 22, 19, 45),
      );
      expect(decision).toEqual({ merge: true, reason: "arrived-together" });
    });

    it("merges across almost the whole of one local day", () => {
      // A minute past midnight and a minute to midnight are 23h58m apart and
      // still the same calendar day.
      expect(
        shouldMerge(
          source({ expiresAt: "2026-08-30" }),
          target({ createdAt: at(2026, 8, 22, 0, 1), expiresAt: "2026-08-24" }),
          at(2026, 8, 22, 23, 59),
        ),
      ).toBe(true);
    });

    it("does not merge across local midnight", () => {
      // Two minutes apart in elapsed time, two days apart on the calendar.
      const decision = decideMerge(
        source({ expiresAt: "2026-08-30" }),
        target({ createdAt: at(2026, 8, 22, 23, 59), expiresAt: "2026-08-24" }),
        at(2026, 8, 23, 0, 1),
      );
      expect(decision).toEqual({ merge: false, reason: "arrived-separately" });
    });

    it("compares calendar days, not elapsed milliseconds", () => {
      // Same wall-clock hour a year apart: never the same day, however the
      // difference is divided.
      expect(
        shouldMerge(
          source({ expiresAt: "2027-08-30" }),
          target({ createdAt: at(2025, 8, 22), expiresAt: "2025-08-24" }),
          at(2026, 8, 22),
        ),
      ).toBe(false);
    });
  });

  describe("clause 2 — long shelf life", () => {
    const differentDay = {
      src: (days: number | null) =>
        source({ shelfLifeDays: days, expiresAt: "2027-01-01" }),
      tgt: target({ createdAt: at(2026, 3, 2), expiresAt: "2026-09-01" }),
      now: at(2026, 8, 22),
    };

    it("merges above the threshold", () => {
      const decision = decideMerge(
        differentDay.src(LONG_LIFE_DAYS + 1),
        differentDay.tgt,
        differentDay.now,
      );
      expect(decision).toEqual({ merge: true, reason: "long-shelf-life" });
    });

    it("does not merge exactly at the threshold", () => {
      // The rule reads "exceeds", so the boundary itself is on the short side.
      expect(
        shouldMerge(
          differentDay.src(LONG_LIFE_DAYS),
          differentDay.tgt,
          differentDay.now,
        ),
      ).toBe(false);
    });

    it("does not merge below the threshold", () => {
      expect(
        shouldMerge(
          differentDay.src(LONG_LIFE_DAYS - 1),
          differentDay.tgt,
          differentDay.now,
        ),
      ).toBe(false);
    });

    it("is inert when the shelf life is unknown", () => {
      // Which is every product until shelf lives arrive.
      expect(
        shouldMerge(differentDay.src(null), differentDay.tgt, differentDay.now),
      ).toBe(false);
    });
  });

  describe("clause 3 — nothing to tell the rows apart", () => {
    it("merges when neither side carries an expiry date", () => {
      const decision = decideMerge(
        source(),
        target({ createdAt: at(2026, 3, 2) }),
        at(2026, 8, 22),
      );
      expect(decision).toEqual({
        merge: true,
        reason: "no-expiry-either-side",
      });
    });

    it("does not merge when only the addition is dated", () => {
      expect(
        shouldMerge(
          source({ expiresAt: "2026-08-30" }),
          target({ createdAt: at(2026, 3, 2), expiresAt: null }),
          at(2026, 8, 22),
        ),
      ).toBe(false);
    });

    it("does not merge when only the existing entry is dated", () => {
      expect(
        shouldMerge(
          source({ expiresAt: null }),
          target({ createdAt: at(2026, 3, 2), expiresAt: "2026-08-24" }),
          at(2026, 8, 22),
        ),
      ).toBe(false);
    });
  });

  describe("the spec's worked examples", () => {
    it("six yoghurts in one session are one entry", () => {
      const now = at(2026, 8, 22, 18);
      expect(
        shouldMerge(
          source({ sameSession: true }),
          target({ createdAt: now }),
          now,
        ),
      ).toBe(true);
    });

    it("milk three days apart stays separate once both are dated", () => {
      expect(
        shouldMerge(
          source({ shelfLifeDays: 7, expiresAt: "2026-08-29" }),
          target({ createdAt: at(2026, 8, 19), expiresAt: "2026-08-26" }),
          at(2026, 8, 22),
        ),
      ).toBe(false);
    });

    it("tinned tomatoes months apart are one entry", () => {
      expect(
        shouldMerge(
          source({ shelfLifeDays: 730, expiresAt: "2028-03-01" }),
          target({ createdAt: at(2026, 3, 2), expiresAt: "2028-01-01" }),
          at(2026, 8, 22),
        ),
      ).toBe(true);
    });
  });
});
