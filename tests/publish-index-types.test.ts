import { describe, expect, it } from "vitest";
import type {
  PhaseType,
  PublishIndex,
  PublishIndexEntry,
  PublishPackageInput,
  PublishPackageResult,
} from "../src/index.js";

describe("publish-index types", () => {
  it("allows every known phase value", () => {
    const phases: PhaseType[] = [
      "PRIMES",
      "PRODUCTS",
      "ANCHORS",
      "ANCHOR_SIEVE",
      "FACTORS",
      "SMALL_CERTIFICATES",
      "SUCCESSIVE_SIEVES",
      "FINAL_CERTIFICATION",
    ];

    expect(phases).toHaveLength(8);
  });

  it("models a complete PublishIndex with entries", () => {
    const entry: PublishIndexEntry = {
      packageId: 1,
      filename: "primes-pack-000001.zip",
      sha256: "a".repeat(64),
      sizeBytes: 1024,
      firstLogicalBlock: 0,
      lastLogicalBlock: 99,
      blockSize: 300,
      blockCount: 100,
      generatorVersion: "1.0.0",
      wheelVersion: "1.0.0",
      publishedAt: "2026-11-04T00:00:00.000Z",
    };
    const index: PublishIndex = { phase: "PRIMES", packages: [entry] };

    expect(index.phase).toBe("PRIMES");
    expect(index.packages[0]?.packageId).toBe(1);
  });

  it("supports the products extension on an entry", () => {
    const entry: PublishIndexEntry = {
      packageId: 1,
      filename: "products-pack-000001.zip",
      sha256: "b".repeat(64),
      sizeBytes: 2048,
      firstLogicalBlock: 0,
      lastLogicalBlock: 99,
      blockSize: 300,
      blockCount: 100,
      generatorVersion: "1.0.0",
      wheelVersion: "1.0.0",
      publishedAt: "2026-11-04T00:00:00.000Z",
      products: {
        sourcePackageId: 1,
        sourceJobId: "job-1",
        sourceBlockIndex: 0,
        sourcePrimeHash: "c".repeat(64),
      },
    };

    expect(entry.products?.sourcePackageId).toBe(1);
  });

  it("models PublishPackageInput and PublishPackageResult", () => {
    const input: PublishPackageInput = {
      phase: "PRODUCTS",
      packageId: 1,
      archive: new Uint8Array([1, 2, 3]),
      blockRange: { first: 0, size: 300 },
      generatorVersion: "1.0.0",
      wheelVersion: "1.0.0",
      products: {
        sourceJobId: "job-1",
        sourceBlockIndex: 0,
        sourcePrimeHash: "d".repeat(64),
      },
    };
    const result: PublishPackageResult = {
      status: "registered",
      entry: {
        packageId: 1,
        filename: "products-pack-000001.zip",
        sha256: "e".repeat(64),
        sizeBytes: 3,
        firstLogicalBlock: 0,
        lastLogicalBlock: 299,
        blockSize: 300,
        blockCount: 100,
        generatorVersion: "1.0.0",
        wheelVersion: "1.0.0",
        publishedAt: "2026-11-04T00:00:00.000Z",
      },
      index: { phase: "PRODUCTS", packages: [] },
    };

    expect(input.phase).toBe("PRODUCTS");
    expect(result.status).toBe("registered");
  });
});
