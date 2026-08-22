// Pulling a product number out of whatever the camera decoded.
//
// Lives on its own because it's the boundary between untrusted scanned data
// and a URL we send to a third party — the one piece of scan handling that's
// worth testing directly.

/**
 * Extract an EAN/UPC/GTIN from a decoded barcode or QR payload.
 *
 * Plain barcodes are already just digits. GS1 Digital Link QR codes wrap the
 * product number in a URL, after a "/01/" segment — that takes priority, since
 * such a URL can hold other digit runs that aren't the product number.
 *
 * Takes `unknown` rather than `string` on purpose: the argument is whatever the
 * scanner handed us, and the type system can't vouch for it.
 *
 * @param data - the raw value the scanner decoded.
 * @returns the barcode digits, or null if there aren't any.
 */
export function extractBarcode(data: unknown): string | null {
  if (typeof data !== "string") return null;

  const gs1 = data.match(/\/01\/(\d{8,14})/);
  const code = gs1 ? gs1[1] : data.match(/\d{8,14}/)?.[0];

  return code ?? null;
}
