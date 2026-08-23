// Injecting a barcode without a camera, in development only.
//
// The iOS Simulator has no camera — not a disabled one, an absent one — so
// every scanning path is unreachable there. That leaves the lookup, the
// debounce, the session, the merge rule and the whole review screen untestable
// end to end on the only device an automated flow can drive.
//
// So a route may be given a `barcode` query parameter, and in development the
// scan screens feed it to exactly the same handler the camera calls:
//
//   exp://127.0.0.1:8081/--/add/scan?barcode=3017620422003
//
// What this does NOT test is the decode itself. That is `expo-camera`'s job,
// not ours, and pretending otherwise would be the lie that makes test-only
// code dangerous. Everything downstream of the decode is real.
//
// Gated on `__DEV__`, which Metro replaces with `false` in a production build,
// so the branch is dead code that minification drops.

import { extractBarcode } from "./barcode";

/**
 * The barcode a route was asked to inject, or null.
 *
 * Returns null in production whatever the URL says, so a link cannot make a
 * shipped build fabricate a scan. The value still goes through
 * `extractBarcode`, because a query parameter is untrusted input like any
 * other and this must not become the one path that skips validation.
 */
export function devBarcodeFrom(param: unknown): string | null {
  if (!__DEV__) return null;
  return extractBarcode(param);
}

/**
 * A comma-separated list of barcodes to inject, filtered to the usable ones.
 *
 * Empty in production. Returns a stable empty array rather than null so the
 * caller's effect dependency does not change shape between builds.
 */
export function devBarcodesFrom(param: unknown): string[] {
  if (!__DEV__ || typeof param !== "string") return [];
  return param
    .split(",")
    .map((part) => devBarcodeFrom(part.trim()))
    .filter((code): code is string => code !== null);
}
