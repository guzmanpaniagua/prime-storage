import { describe, expect, it } from "vitest";
import { FflateZipService } from "../src/index.js";

describe("FflateZipService", () => {
  it("compresses and decompresses JSON", () => {
    const service = new FflateZipService();
    const payload = { hello: "world", numbers: [1, 2, 3, 4, 5] };

    const zip = service.compressJson(payload);

    expect(zip).toBeInstanceOf(Uint8Array);

    const result = service.decompressJson<typeof payload>(zip);

    expect(result).toEqual(payload);
  });
});
