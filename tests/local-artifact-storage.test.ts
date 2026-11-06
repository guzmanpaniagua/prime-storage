import { describe, expect, it } from "vitest";
import {
  FflateZipService,
  LocalArtifactStorage,
} from "../src/index.js";

describe("LocalArtifactStorage", () => {
  it("saves and loads an object with deep equality", async () => {
    const storage = new LocalArtifactStorage();
    const data = { hello: "world", value: 123 };

    const reference = await storage.save(data, {
      type: "test",
      version: "1.0.0",
    });
    const loaded = await storage.load(reference);

    expect(loaded).toEqual(data);
  });

  it("saves and loads a Uint8Array byte by byte", async () => {
    const storage = new LocalArtifactStorage();
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    const reference = await storage.save(data, {
      type: "binary-test",
      version: "1.0.0",
    });
    const result = await storage.load(reference);

    expect(result instanceof Uint8Array).toBe(true);
    expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3, 4, 5]);
  });

  it("recovers metadata after saving", async () => {
    const storage = new LocalArtifactStorage();
    const metadata = { type: "prime", version: "2.0.0" };

    const reference = await storage.save({ hello: "world" }, metadata);
    const recovered = await storage.getMetadata(reference);

    expect(recovered).toEqual(metadata);
  });

  it("round-trips a ZIP produced by ZipService", async () => {
    const storage = new LocalArtifactStorage();
    const zipService = new FflateZipService();
    const payload = { primes: [2, 3, 5, 7, 11], label: "package-50" };
    const zip = zipService.compressJson(payload);

    const reference = await storage.save(zip, {
      type: "primes-package",
      version: "1.0.0",
    });
    const loaded = await storage.load(reference);

    expect(loaded instanceof Uint8Array).toBe(true);
    const decompressed = zipService.decompressJson<Record<string, unknown>>(
      loaded as Uint8Array
    );
    expect(decompressed).toEqual(payload);
  });
});
