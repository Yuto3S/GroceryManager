// Arranging the produce list into what the picker renders.
//
// Kept out of the component for the same reason as `grouping.ts`: which group
// comes first, which items survive a search, and which sections disappear are
// rules worth testing without rendering anything.

import type { ProduceGroup, ProduceItem } from "../data/produce";
import { PRODUCE, PRODUCE_GROUPS } from "../data/produce";
import { normalizeName } from "./identity";

/** One section of the picker. */
export interface ProduceSection {
  group: ProduceGroup;
  items: ProduceItem[];
}

/**
 * The produce list as sections, in a fixed order.
 *
 * Groups follow `PRODUCE_GROUPS` and items are sorted by name inside each, so
 * the list is identical between visits. A picker that reshuffles is a picker
 * you cannot build muscle memory for, which is most of what makes it faster
 * than typing.
 *
 * Empty sections are dropped rather than rendered as a heading over nothing —
 * the same rule `groupPantry` follows for an empty location.
 *
 * @param items - defaults to the whole table; pass a search result to section it.
 */
export function groupProduce(
  items: readonly ProduceItem[] = PRODUCE,
): ProduceSection[] {
  return PRODUCE_GROUPS.map((group) => ({
    group,
    items: items
      .filter((item) => item.group === group)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((section) => section.items.length > 0);
}

/**
 * Filter the produce list by a search term.
 *
 * Matched through `normalizeName`, the same comparison form the catalogue keys
 * use, so `jalapeno` finds `Jalapeño` and `creme` finds `Crème`. Using a plain
 * substring test here would mean two different notions of "the same string" in
 * one app, and the accent the user did not type is exactly the case that
 * matters.
 *
 * @param query - whatever is in the search box; anything unusable matches all.
 */
export function searchProduce(
  query: unknown,
  items: readonly ProduceItem[] = PRODUCE,
): ProduceItem[] {
  const needle = normalizeName(query);
  if (needle === null) return [...items];

  return items.filter((item) => {
    const haystack = normalizeName(item.name);
    return haystack?.includes(needle) ?? false;
  });
}

/**
 * Lay a group's items out in rows of `columns`, for a grid.
 *
 * A `SectionList` has no `numColumns`, so the rows are made here rather than in
 * the component — and this is the kind of off-by-one much easier to assert on
 * than to eyeball.
 *
 * A short final row is left short. Nothing pads it because the tiles are a
 * fixed proportion of the row rather than an equal share of it, so a last row
 * of one renders one tile at its normal width instead of stretching it across
 * the screen.
 */
export function gridRows(
  items: readonly ProduceItem[],
  columns: number,
): ProduceItem[][] {
  if (columns < 1) return [];

  const rows: ProduceItem[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/** Look one up by its stable key. */
export function produceByKey(key: string): ProduceItem | null {
  return PRODUCE.find((item) => item.key === key) ?? null;
}

/** The prefix `catalogueKeyForProduce` puts on a produce identity. */
const CATALOGUE_PREFIX = "produce:";

/**
 * The produce item behind a catalogue key, or null for anything else.
 *
 * Lets a screen that only holds a catalogue key — the add sheet, which is
 * handed an `AddProductInput` — recover the item's icon without every add path
 * having to carry produce-shaped fields it has no use for.
 */
export function produceForCatalogueKey(key: unknown): ProduceItem | null {
  if (typeof key !== "string" || !key.startsWith(CATALOGUE_PREFIX)) return null;
  return produceByKey(key.slice(CATALOGUE_PREFIX.length));
}
