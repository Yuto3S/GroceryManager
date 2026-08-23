import { describe, expect, it, jest } from "@jest/globals";
import { REQUIRED_WEB_FORMAT, webScanningAvailable } from "../scanning";

/** A stand-in for the browser's BarcodeDetector constructor. */
function detectorSupporting(formats: string[] | unknown) {
  const ctor = function BarcodeDetector() {};
  (
    ctor as unknown as { getSupportedFormats: () => Promise<unknown> }
  ).getSupportedFormats = () => Promise.resolve(formats);
  return ctor;
}

describe("webScanningAvailable", () => {
  it("is true when the platform reads grocery barcodes", async () => {
    const detector = detectorSupporting([
      "qr_code",
      REQUIRED_WEB_FORMAT,
      "code_128",
    ]);
    await expect(webScanningAvailable(detector)).resolves.toBe(true);
  });

  it("is false when the API is absent", async () => {
    for (const absent of [undefined, null, {}, "BarcodeDetector", 42]) {
      await expect(webScanningAvailable(absent)).resolves.toBe(false);
    }
  });

  it("is false when the constructor exists but supports nothing", async () => {
    // Desktop Chrome's "partial support": the shim is there, the platform
    // behind it is not. Checking only for the constructor would ship a control
    // that cannot work.
    await expect(webScanningAvailable(detectorSupporting([]))).resolves.toBe(
      false,
    );
  });

  it("is false when it reads QR but not grocery barcodes", async () => {
    const detector = detectorSupporting(["qr_code", "data_matrix"]);
    await expect(webScanningAvailable(detector)).resolves.toBe(false);
  });

  it("is false when the API cannot report its formats", async () => {
    const ctor = function BarcodeDetector() {};
    await expect(webScanningAvailable(ctor)).resolves.toBe(false);
  });

  it("is false rather than throwing when the probe rejects", async () => {
    const ctor = function BarcodeDetector() {};
    (
      ctor as unknown as { getSupportedFormats: () => Promise<string[]> }
    ).getSupportedFormats = () => Promise.reject(new Error("nope"));

    await expect(webScanningAvailable(ctor)).resolves.toBe(false);
  });

  it("is false rather than throwing when the probe returns nonsense", async () => {
    for (const nonsense of [null, undefined, "ean_13", 42, {}]) {
      await expect(
        webScanningAvailable(detectorSupporting(nonsense)),
      ).resolves.toBe(false);
    }
  });

  it("does not construct a detector just to ask", async () => {
    // Probing must not start a camera pipeline or allocate a decoder.
    const constructed = jest.fn();
    const ctor = function BarcodeDetector() {
      constructed();
    };
    (
      ctor as unknown as { getSupportedFormats: () => Promise<string[]> }
    ).getSupportedFormats = () => Promise.resolve([REQUIRED_WEB_FORMAT]);

    await webScanningAvailable(ctor);
    expect(constructed).not.toHaveBeenCalled();
  });
});
