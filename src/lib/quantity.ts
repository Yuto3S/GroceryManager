// Turning a product's quantity text into a starting amount.
//
// The input is whatever a stranger typed into Open Food Facts, so this takes
// `unknown` rather than `string` for the same reason `extractBarcode` does: the
// type system cannot vouch for it, and pretending otherwise would just move the
// crash somewhere less obvious. Nothing in here throws. Anything unrecognized
// falls back to one piece with a step of one, which is always a usable answer.

import type { MeasureUnit, Unit } from "../types";

export interface ParsedQuantity {
  unit: Unit;
  amount: number;
  /** How much one consume tap removes. */
  step: number;
}

/** What every unparseable input becomes. Always safe, never wrong enough to matter. */
export const FALLBACK_QUANTITY: ParsedQuantity = {
  unit: "piece",
  amount: 1,
  step: 1,
};

/** Default consume step for a measure, clamped down when the amount is smaller. */
export const DEFAULT_MEASURE_STEP = 100;

/**
 * Longest input worth looking at. Real quantity strings are a dozen characters;
 * anything past this is noise or an attempt to make the regex work hard.
 */
const MAX_TEXT_LENGTH = 200;

/** Beyond this an amount is a data-entry error, not a pantry item. */
const MAX_AMOUNT = 1_000_000;

/**
 * Unit words, longest-first so `g` cannot swallow the start of `grams`.
 * Each maps to a canonical unit and the factor that converts to it.
 */
const UNITS: { pattern: string; unit: MeasureUnit; factor: number }[] = [
  { pattern: "kilogrammes?|kilograms?|kgs?", unit: "g", factor: 1000 },
  { pattern: "grammes?|grams?|gr|g", unit: "g", factor: 1 },
  { pattern: "millilitres?|milliliters?|mls?", unit: "ml", factor: 1 },
  { pattern: "centilitres?|centiliters?|cls?", unit: "ml", factor: 10 },
  { pattern: "decilitres?|deciliters?|dls?", unit: "ml", factor: 100 },
  { pattern: "litres?|liters?|ls?", unit: "ml", factor: 1000 },
];

const UNIT_GROUP = UNITS.map((u) => u.pattern).join("|");
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;

// "6 x 125 g", "6x125g", "6 × 125 ml" — a multipack is a count of things.
const MULTIPACK = new RegExp(
  String.raw`(\d+)\s*[x×*]\s*${NUMBER}\s*(?:${UNIT_GROUP})\b`,
  "i",
);

// "500 g", "1,5 L", "environ 250 g", "500 g ℮" — a single measure anywhere in
// the string. Leading words are ignored rather than rejected; real data is full
// of them.
const MEASURE = new RegExp(String.raw`${NUMBER}\s*(${UNIT_GROUP})\b`, "i");

/** Resolve a matched unit word to its canonical unit and conversion factor. */
function resolveUnit(
  word: string,
): { unit: MeasureUnit; factor: number } | null {
  const lower = word.toLowerCase();
  for (const candidate of UNITS) {
    if (new RegExp(`^(?:${candidate.pattern})$`, "i").test(lower)) {
      return { unit: candidate.unit, factor: candidate.factor };
    }
  }
  return null;
}

/** Parse a decimal that may use either separator. Comma is the German/French one. */
function toNumber(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Amounts are whole units; a third of a gram is not a thing anyone tracks. */
function normalizeAmount(value: number): number | null {
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > MAX_AMOUNT) return null;
  return rounded;
}

/**
 * Derive a starting amount, unit and consume step from a product's quantity text.
 *
 * @param text - the product's own quantity string, or anything else at all.
 * @returns a usable quantity; `FALLBACK_QUANTITY` when nothing can be read.
 */
export function parseQuantity(text: unknown): ParsedQuantity {
  if (typeof text !== "string") return FALLBACK_QUANTITY;

  // Cap before matching, not after: the point is to bound the work, and a real
  // quantity never lives past the first line of a long string anyway.
  const input = text.slice(0, MAX_TEXT_LENGTH);
  if (input.trim().length === 0) return FALLBACK_QUANTITY;

  // Multipacks first. "6 x 125 g" is six things, and the single-measure pattern
  // below would otherwise read it as 125 g.
  const pack = MULTIPACK.exec(input);
  if (pack?.[1]) {
    const count = toNumber(pack[1]);
    const amount = count === null ? null : normalizeAmount(count);
    if (amount !== null) return { unit: "piece", amount, step: 1 };
  }

  const measure = MEASURE.exec(input);
  if (measure?.[1] && measure[2]) {
    const value = toNumber(measure[1]);
    const resolved = resolveUnit(measure[2]);
    if (value !== null && resolved) {
      const amount = normalizeAmount(value * resolved.factor);
      if (amount !== null) {
        return {
          unit: resolved.unit,
          amount,
          step: Math.min(DEFAULT_MEASURE_STEP, amount),
        };
      }
    }
  }

  return FALLBACK_QUANTITY;
}
