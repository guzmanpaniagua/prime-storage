import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LocalArtifactStorage,
  LocalPublishIndexStore,
} from "../src/index.js";
import type { PublishPackageInput } from "../src/index.js";

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "publish-index-test-"));
  return new LocalPublishIndexStore(new LocalArtifactStorage(dir));
}

function makeInput(overrides?: Partial<PublishPackageInput>): PublishPackageInput {
  return {
    phase: "PRIMES",
    packageId: 1,
    archive: new Uint8Array([1, 2, 3, 4]),
    blockRange: { first: 0, size: 300 },
    generatorVersion: "1.0.0",
    wheelVersion: "1.0.0",
    ...overrides,
  };
}

describe("LocalPublishIndexStore", () => {
  it("returns an empty index when nothing has been published", async () => {
    const store = await createStore();

    const packages = await store.getPublishedPackages("PRIMES");

    expect(packages).toEqual([]);
  });

  it("registers the first package and derives storage fields", async () => {
    const store = await createStore();
    const archive = new Uint8Array([9, 8, 7]);

    const result = await store.registerPublishedPackage({
      phase: "PRIMES",
      packageId: 1,
      archive,
      blockRange: { first: 0, size: 300 },
      generatorVersion: "1.0.0",
      wheelVersion: "1.0.0",
    });

    expect(result.status).toBe("registered");
    expect(result.entry.packageId).toBe(1);
    expect(result.entry.filename).toBe("primes-pack-000001.zip");
    expect(result.entry.sizeBytes).toBe(3);
    expect(result.entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.entry.firstLogicalBlock).toBe(0);
    expect(result.entry.lastLogicalBlock).toBe(299);
    expect(result.entry.publishedAt).toBeTruthy();

    const packages = await store.getPublishedPackages("PRIMES");
    expect(packages).toHaveLength(1);
    expect(packages[0]?.packageId).toBe(1);
  });

  it("recovers a registered package by id", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(
      makeInput({ packageId: 5, blockRange: { first: 1500, size: 300 } })
    );

    const entry = await store.getPublishedPackage("PRIMES", 5);
    expect(entry).not.toBeNull();
    expect(entry?.packageId).toBe(5);
    expect(entry?.firstLogicalBlock).toBe(1500);
    expect(entry?.lastLogicalBlock).toBe(1799);

    const missing = await store.getPublishedPackage("PRIMES", 999);
    expect(entry).not.toBeNull();
    expect(missing).toBeNull();
  });

  it("is idempotent for the same packageId and content", async () => {
    const store = await createStore();
    const input = makeInput();

    const first = await store.registerPublishedPackage(input);
    const second = await store.registerPublishedPackage(input);

    expect(first.status).toBe("registered");
    expect(second.status).toBe("already-published");
    expect(second.entry.sha256).toBe(first.entry.sha256);

    const packages = await store.getPublishedPackages("PRIMES");
    expect(packages).toHaveLength(1);
  });

  it("repairs missing related artifacts without overwriting existing ones on retry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "publish-index-repair-test-"));
    const storage = new LocalArtifactStorage(dir);
    const store = new LocalPublishIndexStore(storage);
    const input = makeInput();
    await store.registerPublishedPackage(input);
    await storage.saveAt(
      { id: "checkpoint-latest", path: "campaigns/campaign-1/state/latest.json" },
      "latest-v1",
      { type: "campaign-checkpoint-latest", version: "1.0.0" }
    );
    await store.registerPublishedPackage({
      ...input,
      additionalArtifacts: [
        {
          reference: { id: "checkpoint-snapshot", path: "campaigns/campaign-1/state/snapshots/checkpoint-000001.json" },
          data: "snapshot-v1",
          metadata: { type: "campaign-checkpoint-snapshot", version: "1.0.0" },
        },
        {
          reference: { id: "checkpoint-latest", path: "campaigns/campaign-1/state/latest.json" },
          data: "latest-v1",
          metadata: { type: "campaign-checkpoint-latest", version: "1.0.0" },
        },
      ],
    });

    await expect(storage.load({ id: "checkpoint-latest", path: "campaigns/campaign-1/state/latest.json" }))
      .resolves.toBe("latest-v1");
    await expect(storage.load({ id: "checkpoint-snapshot", path: "campaigns/campaign-1/state/snapshots/checkpoint-000001.json" }))
      .resolves.toBe("snapshot-v1");
  });

  it("rejects divergent related artifacts instead of overwriting them on retry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "publish-index-conflict-test-"));
    const storage = new LocalArtifactStorage(dir);
    const store = new LocalPublishIndexStore(storage);
    const input = makeInput({
      additionalArtifacts: [{
        reference: { id: "checkpoint-latest", path: "campaigns/campaign-1/state/latest.json" },
        data: "latest-v1",
        metadata: { type: "campaign-checkpoint-latest", version: "1.0.0" },
      }],
    });

    await store.registerPublishedPackage(input);
    await expect(store.registerPublishedPackage({
      ...input,
      additionalArtifacts: [{ ...input.additionalArtifacts![0]!, data: "latest-v2" }],
    })).rejects.toMatchObject({ name: "PublishIndexError", code: "ADDITIONAL_ARTIFACT_CONFLICT" });
    await expect(storage.load({ id: "checkpoint-latest", path: "campaigns/campaign-1/state/latest.json" }))
      .resolves.toBe("latest-v1");
  });

  it("rejects a duplicate packageId with different content", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    await expect(
      store.registerPublishedPackage(
        makeInput({ archive: new Uint8Array([5, 5, 5]) })
      )
    ).rejects.toThrow(/different content/);
  });

  it("rejects invalid packageId", async () => {
    const store = await createStore();

    await expect(
      store.registerPublishedPackage(makeInput({ packageId: 0 }))
    ).rejects.toThrow(/packageId/);
  });

  it("keeps indexes separate per phase", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput({ phase: "PRIMES" }));
    await store.registerPublishedPackage(
      makeInput({
        phase: "PRODUCTS",
        packageId: 1,
        products: {
          strategyVersion: "1.0.0",
          taskContractVersion: "1.0.0",
          validatorVersion: "1.0.0",
          sourceJobId: "job-1",
          sourceBlockIndex: 0,
          sourcePrimeHash: "a".repeat(64),
        },
      })
    );

    const primes = await store.getPublishedPackages("PRIMES");
    const products = await store.getPublishedPackages("PRODUCTS");

    expect(primes).toHaveLength(1);
    expect(products).toHaveLength(1);
    expect(products[0]?.products?.sourcePackageId).toBe(1);
    expect(products[0]?.filename).toBe("products-pack-000001.zip");
  });

  it("includes all PRODUCTS source metadata in idempotency checks", async () => {
    const store = await createStore();
    const input = makeInput({
      phase: "PRODUCTS",
      products: {
        strategyVersion: "products-v1",
        taskContractVersion: "task-v1",
        validatorVersion: "validator-v1",
        sourceJobId: "job-1",
        sourceBlockIndex: 4,
        sourcePrimeHash: "a".repeat(64),
      },
    });

    const first = await store.registerPublishedPackage(input);
    const duplicate = await store.registerPublishedPackage(input);

    expect(first.status).toBe("registered");
    expect(duplicate.status).toBe("already-published");

    const conflictingProducts = [
      { ...input.products!, strategyVersion: "products-v2" },
      { ...input.products!, taskContractVersion: "task-v2" },
      { ...input.products!, validatorVersion: "validator-v2" },
      { ...input.products!, sourceJobId: "job-2" },
      { ...input.products!, sourceBlockIndex: 5 },
      { ...input.products!, sourcePrimeHash: "b".repeat(64) },
    ];

    for (const products of conflictingProducts) {
      await expect(store.registerPublishedPackage({ ...input, products }))
        .rejects.toMatchObject({ name: "PublishIndexError", code: "PACKAGE_CONFLICT" });
    }
  });

  it("publishes a ZIP and recovers it with correct hash and size", async () => {
    const store = await createStore();
    const archive = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    const result = await store.registerPublishedPackage(
      makeInput({ archive })
    );
    expect(result.status).toBe("registered");

    const recovered = await store.getPublishedArchive("PRIMES", 1);

    expect(recovered).not.toBeNull();
    expect(recovered instanceof Uint8Array).toBe(true);
    expect(Array.from(recovered as Uint8Array)).toEqual(Array.from(archive));
    expect(recovered?.byteLength).toBe(archive.byteLength);

    const entry = await store.getPublishedPackage("PRIMES", 1);
    const sha256 = createHash("sha256").update(recovered as Uint8Array).digest("hex");
    expect(sha256).toBe(entry?.sha256);
    expect(recovered?.byteLength).toBe(entry?.sizeBytes);
  });

  it("returns null for a nonexistent package archive", async () => {
    const store = await createStore();

    const missing = await store.getPublishedArchive("PRIMES", 999);
    expect(missing).toBeNull();
  });

  it("is idempotent even when publishedAt differs", async () => {
    const store = await createStore();

    const first = await store.registerPublishedPackage(makeInput());
    expect(first.status).toBe("registered");

    // Simula un re-registro posterior: publishedAt cambia, el resto no.
    const later = new Date(Date.now() + 60_000).toISOString();
    const originalDate = Date;
    // @ts-expect-error - mock global Date para forzar publishedAt distinto
    Date = class extends originalDate {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static now(): number {
        return new Date(later).getTime();
      }
    };

    try {
      const second = await store.registerPublishedPackage(makeInput());
      expect(second.status).toBe("already-published");
      expect(second.entry?.publishedAt).toBe(
        (first as { entry: { publishedAt: string } }).entry.publishedAt
      );
    } finally {
      Date = originalDate;
    }
  });

  it("throws PACKAGE_CONFLICT when re-registering with different content", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    await expect(
      store.registerPublishedPackage(
        makeInput({ archive: new Uint8Array([9, 9, 9]) })
      )
    ).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "PACKAGE_CONFLICT",
    });
  });

  it("throws INDEX_INVALID when the stored index is corrupt", async () => {
    const store = await createStore();
    const storageDir = (store as unknown as { storage: { storageDir: string } })
      .storage.storageDir;

    // Escribe un documento persistido válido cuyo contenido es un índice inválido.
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(join(storageDir, "primes"), { recursive: true });
    await writeFile(
      join(storageDir, "primes", "publish-index.json"),
      JSON.stringify({
        reference: { id: "publish-index-PRIMES", path: "primes/publish-index.json" },
        metadata: { type: "publish-index-primes", version: "1.0.0" },
        contentType: "json",
        data: { phase: "PRIMES", packages: "not-an-array" },
      })
    );

    await expect(store.getPublishedPackages("PRIMES")).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "INDEX_INVALID",
    });
  });

  it("verifyPublishedArchive passes for a valid published archive", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());

    await expect(store.verifyPublishedArchive("PRIMES", 1)).resolves.toBeUndefined();
  });

  it("verifyPublishedArchive throws ARCHIVE_INTEGRITY_ERROR on hash mismatch", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    // Corrompe el archive persistido (documento JSON con base64 distinto).
    const storageDir = (store as unknown as { storage: { storageDir: string } })
      .storage.storageDir;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      join(storageDir, "primes", "primes-pack-000001.zip"),
      JSON.stringify({
        reference: {
          id: "publish-archive-PRIMES-1",
          path: "primes/primes-pack-000001.zip",
        },
        metadata: { type: "publish-archive-primes", version: "1.0.0" },
        contentType: "binary",
        data: Buffer.from([1, 1, 1]).toString("base64"),
      })
    );

    await expect(store.verifyPublishedArchive("PRIMES", 1)).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "ARCHIVE_INTEGRITY_ERROR",
    });
  });

  it("verifyPublishedArchive throws ARCHIVE_INTEGRITY_ERROR on size mismatch", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    // Reescribe el índice con un sizeBytes incorrecto para la misma entrada.
    const storageDir = (store as unknown as { storage: { storageDir: string } })
      .storage.storageDir;
    const { writeFile } = await import("node:fs/promises");
    const index = await store.getPublishedPackages("PRIMES");
    await writeFile(
      join(storageDir, "primes", "publish-index.json"),
      JSON.stringify({
        reference: { id: "publish-index-PRIMES", path: "primes/publish-index.json" },
        metadata: { type: "publish-index-primes", version: "1.0.0" },
        contentType: "json",
        data: {
          phase: "PRIMES",
          packages: [{ ...index[0], sizeBytes: index[0].sizeBytes + 5 }],
        },
      })
    );

    await expect(store.verifyPublishedArchive("PRIMES", 1)).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "ARCHIVE_INTEGRITY_ERROR",
    });
  });

  it("verifyPublishedArchive throws PACKAGE_NOT_FOUND for an unindexed package", async () => {
    const store = await createStore();

    await expect(store.verifyPublishedArchive("PRIMES", 999)).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "PACKAGE_NOT_FOUND",
    });
  });

  it("verifyPublishedArchive throws PACKAGE_ARCHIVE_MISSING when the archive is gone", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    const storageDir = (store as unknown as { storage: { storageDir: string } })
      .storage.storageDir;
    const { rm } = await import("node:fs/promises");
    await rm(join(storageDir, "primes", "primes-pack-000001.zip"), { force: true });

    await expect(store.verifyPublishedArchive("PRIMES", 1)).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "PACKAGE_ARCHIVE_MISSING",
    });
  });

  it("throws ARCHIVE_EXISTS_UNINDEXED when a physical archive exists but is not indexed", async () => {
    const store = await createStore();

    // Crea un archive huérfano en la ruta física del paquete 1.
    const storageDir = (store as unknown as { storage: { storageDir: string } })
      .storage.storageDir;
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(join(storageDir, "primes"), { recursive: true });
    await writeFile(
      join(storageDir, "primes", "primes-pack-000001.zip"),
      JSON.stringify({
        reference: {
          id: "publish-archive-PRIMES-1",
          path: "primes/primes-pack-000001.zip",
        },
        metadata: { type: "publish-archive-primes", version: "1.0.0" },
        contentType: "binary",
        data: Buffer.from([1, 2, 3, 4]).toString("base64"),
      })
    );

    await expect(store.registerPublishedPackage(makeInput())).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "ARCHIVE_EXISTS_UNINDEXED",
    });
  });
});
