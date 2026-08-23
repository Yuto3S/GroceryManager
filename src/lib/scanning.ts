// Whether this platform can actually scan a barcode.
//
// On a phone the camera is native and the answer is always yes. In a browser it
// is not: `BarcodeDetector` is a thin shim over whatever the operating system
// provides, so it can be present while the platform behind it supports nothing.
// That is what "partial support" means for desktop Chrome — and it is why the
// existence of the constructor is not the question.
//
// `expo-camera` would paper over all of this by falling back to a WASM polyfill,
// but that polyfill fetches its engine from a CDN at runtime. We would rather
// offer scanning only where it genuinely works offline; see the change's design
// notes for the reasoning.

import type { BarcodeType } from "expo-camera";
import { Platform } from "react-native";

/** Formats worth scanning for groceries, in expo-camera's naming. */
export const BARCODE_TYPES: BarcodeType[] = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "qr",
];

/**
 * The one format that decides whether scanning groceries is possible at all.
 *
 * EAN-13 is what a grocery barcode is; UPC-A is a subset of it. A backend
 * offering QR but not EAN-13 can read a poster and not a tin of tomatoes, which
 * is not a scanner as far as this app is concerned.
 */
export const REQUIRED_WEB_FORMAT = "ean_13";

/** The shape of the browser API, to the extent we depend on it. */
interface BarcodeDetectorLike {
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * Whether a browser can scan.
 *
 * @param detector - the `BarcodeDetector` constructor, or whatever is at that
 *   name. Injected so this is testable without a browser, and typed loosely
 *   because it comes from the host environment rather than from our code.
 * @returns true only when the platform behind the API actually reads grocery
 *   barcodes. Never throws.
 */
export async function webScanningAvailable(
  detector: unknown = (globalThis as { BarcodeDetector?: unknown })
    .BarcodeDetector,
): Promise<boolean> {
  if (typeof detector !== "function") return false;

  const getSupportedFormats = (detector as unknown as BarcodeDetectorLike)
    .getSupportedFormats;
  if (typeof getSupportedFormats !== "function") return false;

  try {
    const formats = await getSupportedFormats.call(detector);
    return Array.isArray(formats) && formats.includes(REQUIRED_WEB_FORMAT);
  } catch {
    // A rejected probe is an unavailable scanner, not a crash on the add screen.
    return false;
  }
}

/**
 * Whether this platform can scan at all.
 *
 * Async because the browser answer is, and because a control that appears and
 * then turns out not to work is exactly what this exists to prevent.
 */
export async function isScanningAvailable(): Promise<boolean> {
  if (Platform.OS !== "web") return true;
  return webScanningAvailable();
}
