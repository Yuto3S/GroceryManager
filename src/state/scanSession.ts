// The scan session: what has been scanned so far, before any of it becomes a
// pantry entry.
//
// Pure, like the pantry reducer and for the same reason — the clock and the id
// generator arrive on the action, so every rule here is reachable by a test.
//
// The session is deliberately *not* compared against the pantry while scanning.
// Deduplication happens within the session only; the merge rule runs once, at
// confirmation, against the pantry as it is then.

import { addDefaultsFor } from "../lib/catalogue";
import type { CatalogueEntry, MeasureUnit, Product, Unit } from "../types";
import {
  type AddProductInput,
  productInputFor,
  productInputForUnknownBarcode,
} from "./pantryReducer";

/** One barcode seen during a session, however many times. */
export interface ScanSessionItem {
  barcode: string;
  /** How many times it was deliberately scanned. */
  count: number;
  /** Filled in when a background lookup resolves; null until then. */
  product: Product | null;
  /** A name typed during review for a barcode that never resolved. */
  name: string | null;
  /** The session location in force when this item was first scanned. */
  locationId: string;
  /** Overrides chosen during review. Null means "use the catalogue default". */
  unit: Unit | null;
  step: number | null;
  firstScannedAt: number;
  lastScannedAt: number;
}

export interface ScanSession {
  id: string;
  startedAt: number;
  /** Applies to items scanned from now on, not retroactively. */
  locationId: string;
  items: ScanSessionItem[];
}

/**
 * How long a repeat read of the same barcode is treated as camera noise rather
 * than as a second item.
 *
 * The camera fires many times a second while a barcode is in view, so without
 * this, holding steady would add twenty yoghurts. Any threshold is sometimes
 * wrong, which is why the acknowledgement offers an immediate undo — that
 * affordance matters more than this number, and this number should be tuned
 * from real use rather than argued about.
 */
export const RESCAN_DEBOUNCE_MS = 800;

export type ScanOutcome =
  | "added"
  | "incremented"
  | "ignored-duplicate"
  | "no-session";

export interface ScanResult {
  session: ScanSession;
  outcome: ScanOutcome;
}

export type SessionAction =
  | { type: "START"; id: string; locationId: string; now: number }
  | { type: "RESUME"; session: ScanSession }
  | { type: "DISCARD" }
  | { type: "SCAN"; barcode: string; now: number }
  | { type: "RESOLVE"; barcode: string; product: Product }
  | { type: "SET_SESSION_LOCATION"; locationId: string }
  | { type: "DECREMENT_ITEM"; barcode: string }
  | { type: "DROP_ITEM"; barcode: string }
  | {
      type: "PATCH_ITEM";
      barcode: string;
      patch: Partial<
        Pick<ScanSessionItem, "count" | "name" | "locationId" | "unit" | "step">
      >;
    };

export function newSession(
  id: string,
  locationId: string,
  now: number,
): ScanSession {
  return { id, startedAt: now, locationId, items: [] };
}

/** Replace one item, matched by barcode. */
function mapItem(
  session: ScanSession,
  barcode: string,
  change: (item: ScanSessionItem) => ScanSessionItem,
): ScanSession {
  let touched = false;
  const items = session.items.map((item) => {
    if (item.barcode !== barcode) return item;
    touched = true;
    return change(item);
  });
  return touched ? { ...session, items } : session;
}

/**
 * Record a scan.
 *
 * Returns the outcome alongside the session because the three cases — a new
 * item, a deliberate rescan, and a camera repeat — need to be told apart by
 * feedback, and the reducer is the only place that knows which happened.
 */
export function scan(
  session: ScanSession,
  barcode: string,
  now: number,
): ScanResult {
  const existing = session.items.find((item) => item.barcode === barcode);

  if (!existing) {
    const item: ScanSessionItem = {
      barcode,
      count: 1,
      product: null,
      name: null,
      locationId: session.locationId,
      unit: null,
      step: null,
      firstScannedAt: now,
      lastScannedAt: now,
    };
    return {
      session: { ...session, items: [...session.items, item] },
      outcome: "added",
    };
  }

  // Inside the debounce window this is the camera reading one barcode over and
  // over, not the user scanning a second jar.
  if (now - existing.lastScannedAt < RESCAN_DEBOUNCE_MS) {
    return { session, outcome: "ignored-duplicate" };
  }

  return {
    session: mapItem(session, barcode, (item) => ({
      ...item,
      count: item.count + 1,
      lastScannedAt: now,
    })),
    outcome: "incremented",
  };
}

export function sessionReducer(
  session: ScanSession | null,
  action: SessionAction,
): ScanSession | null {
  switch (action.type) {
    case "START":
      return newSession(action.id, action.locationId, action.now);

    case "RESUME":
      return action.session;

    case "DISCARD":
      return null;

    case "SCAN":
      return session === null
        ? null
        : scan(session, action.barcode, action.now).session;

    case "RESOLVE":
      // Patching a resolved product must not disturb the count — the user may
      // have scanned the item three more times while the lookup was in flight.
      return session === null
        ? null
        : mapItem(session, action.barcode, (item) => ({
            ...item,
            product: action.product,
          }));

    case "SET_SESSION_LOCATION":
      // Only the session's own location changes. Items keep the location they
      // were scanned under; relabelling them would silently move things the
      // user already placed.
      return session === null
        ? null
        : { ...session, locationId: action.locationId };

    case "DECREMENT_ITEM": {
      if (session === null) return session;
      const item = session.items.find((i) => i.barcode === action.barcode);
      if (!item) return session;
      // Undoing the only scan removes the item rather than leaving a zero.
      if (item.count <= 1) {
        return {
          ...session,
          items: session.items.filter((i) => i.barcode !== action.barcode),
        };
      }
      return mapItem(session, action.barcode, (i) => ({
        ...i,
        count: i.count - 1,
      }));
    }

    case "DROP_ITEM":
      return session === null
        ? session
        : {
            ...session,
            items: session.items.filter((i) => i.barcode !== action.barcode),
          };

    case "PATCH_ITEM": {
      if (session === null) return session;
      const { count, name, ...rest } = action.patch;
      return mapItem(session, action.barcode, (item) => ({
        ...item,
        ...rest,
        ...(count === undefined
          ? {}
          : { count: Math.max(1, Math.round(count)) }),
        ...(name === undefined ? {} : { name: name?.trim() || null }),
      }));
    }

    default: {
      // Exhaustiveness check: add a variant without a case above and this stops
      // compiling.
      const _exhaustive: never = action;
      return session;
    }
  }
}

/** Items the user still has to name, first — they are what review is for. */
export function needsAttention(item: ScanSessionItem): boolean {
  return item.product === null && item.name === null;
}

/**
 * Session items in review order: everything needing a name first, then the rest
 * alphabetically.
 *
 * Resolved items are already correct by construction — they carry catalogue
 * defaults — so review's job is to make the small set of exceptions impossible
 * to miss, not to present a hundred rows democratically.
 */
export function reviewOrder(session: ScanSession): ScanSessionItem[] {
  return [...session.items].sort((a, b) => {
    const aNeeds = needsAttention(a);
    const bNeeds = needsAttention(b);
    if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
    return displayName(a).localeCompare(displayName(b));
  });
}

/** What to call an item on screen. */
export function displayName(item: ScanSessionItem): string {
  if (item.name) return item.name;
  if (item.product?.name) return item.product.name;
  return item.barcode;
}

/** The measure unit an item would use, if measured. */
export function measureUnitFor(item: ScanSessionItem): MeasureUnit {
  return item.unit === "ml" ? "ml" : "g";
}

/**
 * Read a persisted session back.
 *
 * Persisted data is whatever is on the device — an older build's shape, a
 * partial write, a file someone edited. Anything unusable becomes no session at
 * all rather than a crash on launch, because losing a session is recoverable
 * and refusing to start is not.
 */
export function parseSession(value: unknown): ScanSession | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.startedAt !== "number" ||
    typeof raw.locationId !== "string" ||
    !Array.isArray(raw.items)
  ) {
    return null;
  }

  const items: ScanSessionItem[] = [];
  for (const entry of raw.items) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    if (typeof item.barcode !== "string" || item.barcode.length === 0) continue;

    const count =
      typeof item.count === "number" && Number.isFinite(item.count)
        ? Math.max(1, Math.round(item.count))
        : 1;

    items.push({
      barcode: item.barcode,
      count,
      product:
        typeof item.product === "object" && item.product !== null
          ? (item.product as Product)
          : null,
      name: typeof item.name === "string" ? item.name : null,
      locationId:
        typeof item.locationId === "string" ? item.locationId : raw.locationId,
      unit:
        item.unit === "piece" || item.unit === "g" || item.unit === "ml"
          ? item.unit
          : null,
      step:
        typeof item.step === "number" && Number.isFinite(item.step)
          ? item.step
          : null,
      firstScannedAt:
        typeof item.firstScannedAt === "number" ? item.firstScannedAt : 0,
      lastScannedAt:
        typeof item.lastScannedAt === "number" ? item.lastScannedAt : 0,
    });
  }

  return {
    id: raw.id,
    startedAt: raw.startedAt,
    locationId: raw.locationId,
    items,
  };
}

/** Everything needed to create one pantry entry from one session item. */
export interface SessionAdd {
  product: AddProductInput;
  amount: number;
  unit: Unit;
  step: number;
  measureUnit: MeasureUnit;
  locationId: string;
  /** Always true here: everything in a session arrived together. */
  sameSession: true;
}

/**
 * Identify the product behind a session item.
 *
 * A barcode identifies the product even when the user typed the name during
 * review, so the name is filled in over the barcode's record rather than
 * creating a second, name-keyed one. That is what keeps a later lookup able to
 * resolve it properly.
 */
function productInputForItem(item: ScanSessionItem): AddProductInput {
  if (item.product) {
    const resolved = productInputFor(item.product);
    if (resolved) return resolved;
  }

  const unknown = productInputForUnknownBarcode(item.barcode);
  if (item.name) {
    return { ...unknown, name: item.name, needsName: false };
  }
  return unknown;
}

/**
 * Turn one session item into the add it represents.
 *
 * `count` is how many times the thing was scanned, which is not always the
 * amount: two 500 g bags are 1000 g, not "2 g". For a counted product the two
 * coincide, which is why the model gets away with one number.
 *
 * @param catalogue - the pantry catalogue, for defaults the user already set.
 */
export function sessionItemToAdd(
  item: ScanSessionItem,
  catalogue: Record<string, CatalogueEntry>,
): SessionAdd {
  const product = productInputForItem(item);
  const defaults = addDefaultsFor(
    catalogue[product.key] ?? null,
    product.quantityText,
  );

  const unit: Unit = item.unit ?? defaults.unit;
  const isCount = unit === "piece";

  return {
    product,
    unit,
    amount: isCount ? item.count : item.count * defaults.measureAmount,
    step: item.step ?? (isCount ? defaults.countStep : defaults.measureStep),
    measureUnit: defaults.measureUnit,
    locationId: item.locationId,
    sameSession: true,
  };
}

/** Every add a confirmed session produces, in review order. */
export function sessionToAdds(
  session: ScanSession,
  catalogue: Record<string, CatalogueEntry>,
): SessionAdd[] {
  return reviewOrder(session).map((item) => sessionItemToAdd(item, catalogue));
}
