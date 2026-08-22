import { lookupProduct } from "../openFoodFacts";

const BARCODE = "3017620422003";

const payload = (productOverrides = {}) => ({
  status: 1,
  product: {
    code: BARCODE,
    product_name: "Nutella",
    brands: "Ferrero, Nutella",
    quantity: "400 g",
    image_front_small_url: "https://images.openfoodfacts.org/front.jpg",
    nutriscore_grade: "e",
    ...productOverrides,
  },
});

function mockResponse(body, { ok = true, status = 200 } = {}) {
  global.fetch = jest.fn().mockResolvedValue({ ok, status, json: async () => body });
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("lookupProduct", () => {
  it("normalizes a product, keeping only the first brand", async () => {
    mockResponse(payload());
    await expect(lookupProduct(BARCODE)).resolves.toEqual({
      barcode: BARCODE,
      name: "Nutella",
      brand: "Ferrero",
      quantity: "400 g",
      imageUrl: "https://images.openfoodfacts.org/front.jpg",
      nutriScore: "E",
    });
  });

  it("requests the barcode we asked for", async () => {
    mockResponse(payload());
    await lookupProduct(BARCODE);
    expect(global.fetch.mock.calls[0][0]).toContain(`/product/${BARCODE}.json`);
  });

  describe("untrusted image URLs", () => {
    // Open Food Facts is community-editable, so a vandalized record could point
    // <Image> at cleartext or at something local. Only https survives.
    it.each([
      ["cleartext http", "http://example.com/x.jpg"],
      ["a data URI", "data:image/png;base64,AAAA"],
      ["a local file", "file:///etc/passwd"],
      ["javascript", "javascript:alert(1)"],
      ["a protocol-relative URL", "//example.com/x.jpg"],
      ["junk", "not-a-url"],
    ])("drops %s", async (_label, url) => {
      mockResponse(payload({ image_front_small_url: url }));
      await expect(lookupProduct(BARCODE)).resolves.toMatchObject({
        imageUrl: null,
      });
    });

    it("keeps a plain https URL", async () => {
      mockResponse(payload({ image_front_small_url: "https://ok.example/x.jpg" }));
      await expect(lookupProduct(BARCODE)).resolves.toMatchObject({
        imageUrl: "https://ok.example/x.jpg",
      });
    });
  });

  it("refuses a non-numeric barcode without hitting the network", async () => {
    await expect(lookupProduct("https://evil.example/steal")).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["the product is absent from the database", { status: 0 }],
    ["the response has no product", { status: 1 }],
  ])("returns null when %s", async (_label, body) => {
    mockResponse(body);
    await expect(lookupProduct(BARCODE)).resolves.toBeNull();
  });

  it("falls back to a placeholder name", async () => {
    mockResponse(payload({ product_name: "   " }));
    await expect(lookupProduct(BARCODE)).resolves.toMatchObject({
      name: "Unknown product",
    });
  });

  it("throws with the status code on an HTTP error", async () => {
    mockResponse({}, { ok: false, status: 503 });
    await expect(lookupProduct(BARCODE)).rejects.toThrow("(503)");
  });

  it("reports a timeout rather than leaking the AbortError", async () => {
    const aborted = new Error("The operation was aborted");
    aborted.name = "AbortError";
    global.fetch = jest.fn().mockRejectedValue(aborted);

    await expect(lookupProduct(BARCODE)).rejects.toThrow("timed out");
  });

  it("passes an abort signal so the request can be cancelled", async () => {
    mockResponse(payload());
    await lookupProduct(BARCODE);
    expect(global.fetch.mock.calls[0][1].signal).toBeDefined();
  });
});
