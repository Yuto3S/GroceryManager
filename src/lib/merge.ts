// Deciding whether a newly added product joins an existing pantry entry or
// starts its own.
//
// Six yoghurts scanned together share an expiry date, so they are genuinely one
// entry with amount 6. Milk bought today and milk bought last week do not, so
// they are two rows. The discriminator is whether they arrived together — shelf
// life is a secondary relaxation for goods where a few days' difference is
// immaterial.
//
// Pure, and deliberately so: this is a handful of branches whose boundary cases
// (midnight, exactly at the threshold, one side dated) are worth a table of
// tests rather than an eyeball.

/**
 * Above this many days, two lots of the same product are treated as
 * interchangeable and merged regardless of when they arrived. Tinned tomatoes
 * bought in March and in August do not need separate rows.
 *
 * Inert until a later change supplies real shelf lives — `shelfLifeDays` is
 * null for every product until then.
 */
export const LONG_LIFE_DAYS = 30;

/** The existing entry a new addition might join. */
export interface MergeTarget {
  productKey: string;
  /** UTC epoch milliseconds. */
  createdAt: number;
  /** `YYYY-MM-DD`, or null when the entry has no expiry date. */
  expiresAt: string | null;
}

/** The product being added. */
export interface MergeSource {
  productKey: string;
  /** Days the product keeps for, or null when unknown. */
  shelfLifeDays: number | null;
  /** `YYYY-MM-DD`, or null when the addition has no expiry date. */
  expiresAt: string | null;
  /**
   * True when this addition and the target arrived in the same add session.
   * Sessions belong to the rapid-scan flow; one-at-a-time adds leave this
   * unset and rely on the calendar-day test below, which covers the same case.
   */
  sameSession?: boolean;
}

/**
 * Whether two epoch timestamps fall on the same day in the *user's* timezone.
 *
 * Compared component by component rather than by dividing the millisecond
 * difference: a day is not reliably 86,400,000 ms once daylight saving is
 * involved, and "same day" is a question about the local calendar, not about
 * elapsed time.
 */
function isSameLocalDay(a: number, b: number): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Why a decision came out the way it did. Useful in tests and when debugging. */
export type MergeReason =
  | "different-product"
  | "arrived-together"
  | "long-shelf-life"
  | "no-expiry-either-side"
  | "arrived-separately";

export interface MergeDecision {
  merge: boolean;
  reason: MergeReason;
}

/**
 * Decide whether an addition merges into an existing entry.
 *
 * @param source - the product being added.
 * @param target - the existing entry being considered.
 * @param now - the moment of the addition, UTC epoch milliseconds.
 */
export function decideMerge(
  source: MergeSource,
  target: MergeTarget,
  now: number,
): MergeDecision {
  if (source.productKey !== target.productKey) {
    return { merge: false, reason: "different-product" };
  }

  // 1. Arrived together — same add session, or the same day on the user's
  //    calendar. Anything bought in one trip shares a date, so it is one lot.
  if (source.sameSession === true || isSameLocalDay(target.createdAt, now)) {
    return { merge: true, reason: "arrived-together" };
  }

  // 2. Keeps long enough that a few weeks' difference does not matter.
  if (source.shelfLifeDays !== null && source.shelfLifeDays > LONG_LIFE_DAYS) {
    return { merge: true, reason: "long-shelf-life" };
  }

  // 3. Neither side has an expiry date. Splitting here would produce two rows
  //    with nothing to tell them apart, which is worse than one row that is
  //    slightly too coarse.
  if (source.expiresAt === null && target.expiresAt === null) {
    return { merge: true, reason: "no-expiry-either-side" };
  }

  return { merge: false, reason: "arrived-separately" };
}

/** `decideMerge` when only the answer is wanted. */
export function shouldMerge(
  source: MergeSource,
  target: MergeTarget,
  now: number,
): boolean {
  return decideMerge(source, target, now).merge;
}
