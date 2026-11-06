import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LocalArtifactStorage,
  LocalPublishIndexStore,
  phaseIndexFromStore,
} from "../src/index.js";
import type { PublishPackageInput } from "../src/index.js";

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "phase-index-adapter-test-"));
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

describe("phaseIndexFromStore (adaptador temporal, issue 23)", () => {
  it("índice inexistente → índice vacío (equivalente al monolito)", async () => {
    const store = await createStore();

    const index = await phaseIndexFromStore(store, "PRIMES");
    expect(index).toEqual({ phase: "PRIMES", packages: [] });
  });

  it("índice válido → reconstruye { phase, packages } (equivalente al monolito)", async () => {
    const store = await createStore();

    const registered = await store.registerPublishedPackage(makeInput());
    const registeredEntry =
      "entry" in registered ? registered.entry : undefined;
    expect(registeredEntry).toBeDefined();

    const index = await phaseIndexFromStore(store, "PRIMES");
    expect(index.phase).toBe("PRIMES");
    expect(index.packages).toHaveLength(1);
    expect(index.packages[0]?.packageId).toBe(1);
    expect(index.packages[0]?.filename).toBe(registeredEntry?.filename);
    expect(index.packages[0]?.sha256).toBe(registeredEntry?.sha256);
  });

  it("índice corrupto → INDEX_INVALID (el monolito lanza GITHUB_INDEX_INVALID)", async () => {
    const store = await createStore();
    const storageDir = (store as unknown as {
      storage: { storageDir: string };
    }).storage.storageDir;

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

    await expect(phaseIndexFromStore(store, "PRIMES")).rejects.toMatchObject({
      name: "PublishIndexError",
      code: "INDEX_INVALID",
    });
  });

  it("mantiene el orden de packages por packageId", async () => {
    const store = await createStore();

    await store.registerPublishedPackage(makeInput({ packageId: 3 }));
    await store.registerPublishedPackage(makeInput({ packageId: 1 }));
    await store.registerPublishedPackage(makeInput({ packageId: 2 }));

    const index = await phaseIndexFromStore(store, "PRIMES");
    expect(index.packages.map((entry) => entry.packageId)).toEqual([1, 2, 3]);
  });
});
