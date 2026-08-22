import { extractBarcode } from "../barcode";

describe("extractBarcode", () => {
  it("passes through a plain EAN-13", () => {
    expect(extractBarcode("3017620422003")).toBe("3017620422003");
  });

  it("passes through a plain EAN-8", () => {
    expect(extractBarcode("40084015")).toBe("40084015");
  });

  it("pulls the product number out of a GS1 Digital Link", () => {
    expect(extractBarcode("https://id.gs1.org/01/09506000134352/21/XYZ")).toBe(
      "09506000134352"
    );
  });

  it("prefers the /01/ segment over an earlier digit run", () => {
    // The fallback would have grabbed 99999999 here, which isn't the product.
    expect(extractBarcode("https://example.com/99999999/01/09506000134352")).toBe(
      "09506000134352"
    );
  });

  // The security-relevant cases: anything below must NOT reach Open Food Facts.
  it.each([
    ["a plain URL", "https://example.com/hello"],
    ["a Wi-Fi config QR", "WIFI:S:MyNetwork;T:WPA;P:hunter2;;"],
    ["free text", "scan me"],
    ["an empty string", ""],
    ["too few digits", "1234567"],
  ])("returns null for %s", (_label, input) => {
    expect(extractBarcode(input)).toBeNull();
  });

  it.each([[null], [undefined], [42], [{}]])(
    "returns null for non-string input (%p)",
    (input) => {
      expect(extractBarcode(input)).toBeNull();
    }
  );
});
