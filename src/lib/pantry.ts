// What happens to a pantry entry when you use some of it.
//
// Pure functions over an entry, taking `now` rather than reading the clock, so
// the whole set is testable and the reducer stays a thin dispatcher over it.
// None of these mutate their argument.

import type { PantryEntry } from "../types";

/** An entry with nothing left. It stays persisted — it is the purchase history. */
export function isOutOfStock(entry: PantryEntry): boolean {
  return entry.amount <= 0;
}

/** Whether an entry belongs in the pantry view. Tombstoned and empty ones do not. */
export function isVisible(entry: PantryEntry): boolean {
  return entry.deletedAt === null && !isOutOfStock(entry);
}

/** Amounts are whole, non-negative, and finite whatever arithmetic produced them. */
function clampAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * Remove one step's worth.
 *
 * Clamps at zero rather than going negative: a step larger than what is left
 * means "I finished it", not "I owe some". That is the common case for bulk
 * goods, where the last scoop is always smaller than the step.
 */
export function consume(entry: PantryEntry, now: number): PantryEntry {
  return {
    ...entry,
    amount: clampAmount(entry.amount - entry.step),
    updatedAt: now,
  };
}

/**
 * Add to an entry. Reviving an out-of-stock entry is the same operation — it
 * becomes visible again by having an amount, with no separate un-hide step.
 */
export function restock(
  entry: PantryEntry,
  amount: number,
  now: number,
): PantryEntry {
  const added = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return {
    ...entry,
    amount: clampAmount(entry.amount + added),
    updatedAt: now,
  };
}

/** Set the amount outright, for the detail screen's editing. */
export function setAmount(
  entry: PantryEntry,
  amount: number,
  now: number,
): PantryEntry {
  return { ...entry, amount: clampAmount(amount), updatedAt: now };
}

/**
 * Remove an entry, whatever is left of it.
 *
 * Distinct from consuming it to zero: a tombstone says the user got rid of it,
 * an out-of-stock entry says they finished it. Later features read the
 * difference, so it is recorded rather than collapsed.
 */
export function remove(entry: PantryEntry, now: number): PantryEntry {
  return { ...entry, deletedAt: now, updatedAt: now };
}
