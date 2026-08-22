// Arranging the pantry into the sections the list screen renders.
//
// Kept out of the component so the ordering rules — which group comes first,
// which row comes first, which groups disappear — are testable without
// rendering anything.

import type { CatalogueEntry, Location, PantryEntry } from "../types";
import { isVisible } from "./pantry";

/** Where entries with no derivable category go. */
export const OTHER_CATEGORY = "Other";

/** What the user is shown before a lookup has ever supplied a name. */
export const UNNAMED_PRODUCT = "Unnamed product";

export type GroupMode = "location" | "category";

/** One entry, resolved against its catalogue record for display. */
export interface PantryRow {
  entry: PantryEntry;
  product: CatalogueEntry | null;
  name: string;
}

export interface PantryGroup {
  /** Stable key for the list; a location id, or the category name. */
  key: string;
  title: string;
  rows: PantryRow[];
}

function rowFor(
  entry: PantryEntry,
  catalogue: Record<string, CatalogueEntry>,
): PantryRow {
  const product = catalogue[entry.productKey] ?? null;
  const name = product && !product.needsName ? product.name : UNNAMED_PRODUCT;
  return { entry, product, name };
}

/**
 * Group the visible pantry for display.
 *
 * Out-of-stock and removed entries are excluded here rather than by the caller:
 * every consumer of this wants the same answer, and "which entries count as
 * being in the pantry" is one rule, in one place.
 *
 * Groups with nothing visible in them are dropped, so an empty freezer is not a
 * heading over blank space.
 *
 * @param locations - live locations, in the order their groups should appear.
 */
export function groupPantry(
  entries: Record<string, PantryEntry>,
  catalogue: Record<string, CatalogueEntry>,
  locations: Location[],
  mode: GroupMode,
): PantryGroup[] {
  const rows = Object.values(entries)
    .filter(isVisible)
    .map((entry) => rowFor(entry, catalogue));

  const byKey = new Map<string, PantryRow[]>();
  for (const row of rows) {
    const key =
      mode === "location"
        ? row.entry.locationId
        : (row.product?.category ?? OTHER_CATEGORY);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else byKey.set(key, [row]);
  }

  const groups: PantryGroup[] =
    mode === "location"
      ? // Locations keep the order the user created them in, so the sections
        // do not jump around as entries come and go.
        locations
          .filter((location) => byKey.has(location.id))
          .map((location) => ({
            key: location.id,
            title: location.name,
            rows: byKey.get(location.id) ?? [],
          }))
      : [...byKey.keys()]
          .sort((a, b) => {
            // "Other" is a leftovers bucket, so it sits at the bottom whatever
            // it is called.
            if (a === OTHER_CATEGORY) return 1;
            if (b === OTHER_CATEGORY) return -1;
            return a.localeCompare(b);
          })
          .map((category) => ({
            key: category,
            title: category,
            rows: byKey.get(category) ?? [],
          }));

  for (const group of groups) {
    group.rows.sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.entry.createdAt - b.entry.createdAt,
    );
  }

  return groups;
}

/**
 * What share of visible entries have no derivable category.
 *
 * Exists because group-by-category is only worth shipping if this number is
 * small — Open Food Facts tags are messy and typed items have none at all.
 *
 * @returns a fraction between 0 and 1; 0 when the pantry is empty.
 */
export function otherCategoryShare(
  entries: Record<string, PantryEntry>,
  catalogue: Record<string, CatalogueEntry>,
): number {
  const visible = Object.values(entries).filter(isVisible);
  if (visible.length === 0) return 0;

  const uncategorized = visible.filter(
    (entry) => !catalogue[entry.productKey]?.category,
  ).length;
  return uncategorized / visible.length;
}
