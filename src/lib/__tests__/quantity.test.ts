import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_MEASURE_STEP,
  FALLBACK_QUANTITY,
  parseQuantity,
} from "../quantity";

describe("parseQuantity", () => {
  describe("masses", () => {
    it("reads a plain gram amount", () => {
      expect(parseQuantity("500 g")).toEqual({
        unit: "g",
        amount: 500,
        step: 100,
      });
    });

    it("converts kilograms to grams", () => {
      expect(parseQuantity("1 kg")).toEqual({
        unit: "g",
        amount: 1000,
        step: 100,
      });
    });

    it("does not need a space before the unit", () => {
      expect(parseQuantity("750g")).toMatchObject({ unit: "g", amount: 750 });
    });

    it("reads spelled-out units", () => {
      expect(parseQuantity("250 grams")).toMatchObject({
        unit: "g",
        amount: 250,
      });
    });
  });

  describe("volumes", () => {
    it("converts litres to millilitres", () => {
      expect(parseQuantity("1 L")).toEqual({
        unit: "ml",
        amount: 1000,
        step: 100,
      });
    });

    it("handles a comma decimal separator with no space", () => {
      expect(parseQuantity("1,5L")).toEqual({
        unit: "ml",
        amount: 1500,
        step: 100,
      });
    });

    it("converts centilitres", () => {
      expect(parseQuantity("33 cl")).toMatchObject({
        unit: "ml",
        amount: 330,
      });
    });
  });

  describe("multipacks are a count, not a measure", () => {
    it("reads the pack size rather than the unit size", () => {
      expect(parseQuantity("6 x 125 g")).toEqual({
        unit: "piece",
        amount: 6,
        step: 1,
      });
    });

    it("handles the multiplication sign and no spaces", () => {
      expect(parseQuantity("4×100g")).toEqual({
        unit: "piece",
        amount: 4,
        step: 1,
      });
    });
  });

  describe("real-world noise around the number", () => {
    it("ignores the estimated-sign suffix", () => {
      expect(parseQuantity("500 g ℮")).toMatchObject({
        unit: "g",
        amount: 500,
      });
    });

    it("ignores leading words", () => {
      expect(parseQuantity("environ 250 g")).toMatchObject({
        unit: "g",
        amount: 250,
      });
    });
  });

  describe("the step never exceeds the amount", () => {
    it("clamps so one tap cannot overshoot an amount smaller than the step", () => {
      const parsed = parseQuantity("50 g");
      expect(parsed.amount).toBe(50);
      expect(parsed.step).toBe(50);
      expect(parsed.step).toBeLessThanOrEqual(parsed.amount);
    });

    it("uses the default step when the amount is larger", () => {
      expect(parseQuantity("900 g").step).toBe(DEFAULT_MEASURE_STEP);
    });
  });

  describe("anything it cannot read falls back to one piece", () => {
    // The point of taking `unknown`: these are all reachable, because the text
    // comes from a community-editable database, not from our own code.
    const unreadable: [string, unknown][] = [
      ["empty string", ""],
      ["whitespace only", "   "],
      ["null", null],
      ["undefined", undefined],
      ["a number", 42],
      ["an object", {}],
      ["an array", ["500 g"]],
      ["a boolean", true],
      ["emoji", "🥛🧀"],
      ["words with no quantity", "family pack"],
      ["a unit with no number", "g"],
      ["a number with no unit", "500"],
      ["zero", "0 g"],
      ["an implausible amount", "99999999 kg"],
    ];

    it.each(unreadable)("falls back for %s", (_label, input) => {
      expect(parseQuantity(input)).toEqual(FALLBACK_QUANTITY);
    });

    it("does not hang or throw on a 10 kB string", () => {
      const huge = "9".repeat(10_000);
      expect(() => parseQuantity(huge)).not.toThrow();
      expect(parseQuantity(huge)).toEqual(FALLBACK_QUANTITY);
    });

    it("does not throw on a long string that ends in something parseable", () => {
      // Only the capped prefix is examined, so a quantity hidden past the cap
      // is missed rather than found. Missing it is the safe direction.
      const buried = `${"a".repeat(10_000)} 500 g`;
      expect(parseQuantity(buried)).toEqual(FALLBACK_QUANTITY);
    });
  });

  it("never returns a non-positive amount or step", () => {
    const inputs = ["500 g", "1 kg", "6 x 125 g", "", "🥛", "0 ml", "1,5L"];
    for (const input of inputs) {
      const { amount, step } = parseQuantity(input);
      expect(amount).toBeGreaterThan(0);
      expect(step).toBeGreaterThan(0);
      expect(Number.isInteger(amount)).toBe(true);
    }
  });
});
