// Finding a product you have bought before.
//
// The catalogue never evicts, so this list only grows — which makes ordering
// and search the difference between "add without scanning" being useful and
// being a wall of text.

import type { CatalogueEntry, MeasureUnit, Unit } from "../types";
import { normalizeName } from "./identity";
import { DEFAULT_MEASURE_STEP, parseQuantity } from "./quantity";

/** A catalogue record ready to show in a picker. */
export type CatalogueChoice = CatalogueEntry;

/**
 * Order the catalogue for the picker: most-used first, then alphabetically.
 *
 * The tie-break matters more than it looks. Most records sit at one use, so
 * without a stable second key the list would reshuffle on every render.
 */
export function orderCatalogue(
  catalogue: Record<string, CatalogueEntry>,
): CatalogueChoice[] {
  return Object.values(catalogue)
    .filter((record) => record.deletedAt === null)
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Filter the catalogue by a search term.
 *
 * Matched against the same normalized form the catalogue keys use, so
 * searching `creme` finds `Crème fraîche` — the accent the user did not type is
 * exactly the reason search is here rather than a plain substring test.
 *
 * @param query - whatever is in the search box; anything unusable matches all.
 */
export function searchCatalogue(
  catalogue: Record<string, CatalogueEntry>,
  query: unknown,
): CatalogueChoice[] {
  const ordered = orderCatalogue(catalogue);
  const needle = normalizeName(query);
  if (needle === null) return ordered;

  return ordered.filter((record) => {
    const haystack = normalizeName(`${record.name} ${record.brand}`);
    return haystack?.includes(needle) ?? false;
  });
}

/** Fallback measure amount when the product's own text gives no mass or volume. */
const FALLBACK_MEASURE_AMOUNT = 100;

/**
 * What the add sheet starts with, for both ways of expressing a quantity.
 *
 * Both forms are always filled in, because the sheet lets the user switch
 * between them before confirming and each side needs somewhere to land.
 */
export interface AddDefaults {
  unit: Unit;
  measureUnit: MeasureUnit;
  countAmount: number;
  countStep: number;
  measureAmount: number;
  measureStep: number;
  locationId: string | null;
}

/**
 * Work out what the add sheet should be pre-filled with.
 *
 * The catalogue record wins wherever it has an opinion — it holds choices the
 * user already made for this product, and asking again would be the app
 * forgetting. Everything else is derived from the product's own quantity text,
 * and where that says nothing, from a plain one-piece default.
 *
 * @param record - the product's catalogue record, or null the first time.
 * @param quantityText - the product's own quantity string; untrusted.
 */
export function addDefaultsFor(
  record: CatalogueEntry | null,
  quantityText: unknown,
): AddDefaults {
  const parsed = parseQuantity(quantityText);
  const parsedIsCount = parsed.unit === "piece";

  // Compared inline rather than through `parsedIsCount`: the narrowing is what
  // proves this is a measure unit, and a boolean does not carry it.
  const measureUnit: MeasureUnit =
    record?.measureUnit ?? (parsed.unit === "piece" ? "g" : parsed.unit);

  return {
    // A product whose text gives a mass opens on the measure form; anything
    // else opens on the count, which is the answer for most of a fridge.
    unit: record?.defaultUnit ?? parsed.unit,
    measureUnit,
    countAmount: parsedIsCount ? parsed.amount : 1,
    countStep: record?.countStep ?? 1,
    measureAmount: parsedIsCount ? FALLBACK_MEASURE_AMOUNT : parsed.amount,
    measureStep:
      record?.measureStep ??
      (parsedIsCount ? DEFAULT_MEASURE_STEP : parsed.step),
    locationId: record?.defaultLocationId ?? null,
  };
}
