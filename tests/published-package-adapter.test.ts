import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LocalArtifactStorage,
  LocalPublishIndexStore,
  publishedPackageFromStore,
} from "../src/index.js";
import type { PublishPackageInput } from "../src/index.js";

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "published-package-adapter-test-"));
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

describe("publishedPackageFromStore (adaptador temporal, issue 24)", () => {
  it("paquete válido → devuelve { entry, bytes } con integridad correcta", async () => {
    const store = await createStore();
    const archive = new Uint8Array([9, 8, 7, 6, 5]);

    const registered = await store.registerPublishedPackage(
      makeInput({ archive })
    );
    const registeredEntry =
      "entry" in registered ? registered.entry : undefined;
    expect(registeredEntry).toBeDefined();

    const { entry, bytes } = await publishedPackageFromStore(
      store,
      "PRIMES",
      1
    );
    expect(entry.packageId).toBe(1);
    expect(entry.filename).toBe(registeredEntry?.filename);
    expect(entry.sha256).toBe(registeredEntry?.sha256);
    expect(bytes).toEqual(archive);
  });

  it("packageId inválido → INVALID_PACKAGE_ID", async () => {
    const store = await createStore();

    await expect(publishedPackageFromStore(store, "PRIMES", 0)).rejects.toMatchObject(
      { name: "PublishIndexError", code: "INVALID_PACKAGE_ID" }
    );
    await expect(
      publishedPackageFromStore(store, "PRIMES", -3)
    ).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "INVALID_PACKAGE_ID",
    });
    await expect(
      publishedPackageFromStore(store, "PRIMES", 1.5)
    ).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "INVALID_PACKAGE_ID",
    });
  });

  it("package inexistente → PACKAGE_NOT_FOUND", async () => {
    const store = await createStore();

    await expect(publishedPackageFromStore(store, "PRIMES", 999)).rejects.toMatchObject(
      { name: "PublishIndexError", code: "PACKAGE_NOT_FOUND" }
    );
  });

  it("archive inexistente → PACKAGE_ARCHIVE_MISSING", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    // Elimina el archive persistido dejando la entrada del índice intacta.
    const storageDir = (store as unknown as {
      storage: { storageDir: string };
    }).storage.storageDir;
    const { rm } = await import("node:fs/promises");
    await rm(join(storageDir, "PRIMES", "primes-pack-000001.zip"), {
      force: true,
    });

    await expect(publishedPackageFromStore(store, "PRIMES", 1)).rejects.toMatchObject(
      { name: "PublishIndexError", code: "PACKAGE_ARCHIVE_MISSING" }
    );
  });

  it("archive corrupto → ARCHIVE_INTEGRITY_ERROR", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput());
    // Corrompe el archive persistido.
    const storageDir = (store as unknown as {
      storage: { storageDir: string };
    }).storage.storageDir;
    const { writeFile } = await import("node:fs/promises");
    // El storage persiste binarios como documento JSON (base64): escribe
    // un documento válido cuyo contenido NO coincide con el hash del índice.
    await writeFile(
      join(storageDir, "PRIMES", "primes-pack-000001.zip"),
      JSON.stringify({
        reference: {
          id: "publish-archive-PRIMES-1",
          path: "PRIMES/primes-pack-000001.zip",
        },
        metadata: { type: "publish-archive-primes", version: "1.0.0" },
        contentType: "binary",
        data: Buffer.from([1, 1, 1]).toString("base64"),
      })
    );

    await expect(publishedPackageFromStore(store, "PRIMES", 1)).rejects.toMatchObject(
      { name: "PublishIndexError", code: "ARCHIVE_INTEGRITY_ERROR" }
    );
  });
});
