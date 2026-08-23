import { describe, expect, it } from "@jest/globals";
import { devBarcodeFrom, devBarcodesFrom } from "../devScan";

// Jest runs with __DEV__ true, which is the branch worth testing: the
// production branch is `return null` and Metro deletes it.
describe("devBarcodeFrom", () => {
  it("accepts a plain barcode", () => {
    expect(devBarcodeFrom("3017620422003")).toBe("3017620422003");
  });

  it("goes through the same validation as a camera read", () => {
    expect(devBarcodeFrom("not a barcode")).toBeNull();
    expect(devBarcodeFrom("12")).toBeNull();
  });

  it("takes anything, because a query parameter is untrusted", () => {
    expect(devBarcodeFrom(undefined)).toBeNull();
    expect(devBarcodeFrom(42)).toBeNull();
    expect(devBarcodeFrom(["3017620422003"])).toBeNull();
  });
});

describe("devBarcodesFrom", () => {
  it("splits a comma-separated list", () => {
    expect(devBarcodesFrom("3017620422003,5000112637922")).toEqual([
      "3017620422003",
      "5000112637922",
    ]);
  });

  it("tolerates spaces around the commas", () => {
    expect(devBarcodesFrom(" 3017620422003 , 5000112637922 ")).toHaveLength(2);
  });

  it("drops entries that are not barcodes rather than the whole list", () => {
    expect(devBarcodesFrom("3017620422003,rubbish")).toEqual(["3017620422003"]);
  });

  it("returns an empty array for anything unusable", () => {
    expect(devBarcodesFrom(undefined)).toEqual([]);
    expect(devBarcodesFrom("")).toEqual([]);
    expect(devBarcodesFrom(7)).toEqual([]);
  });
});
