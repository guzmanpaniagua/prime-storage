import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CampaignCheckpointError,
  LocalArtifactStorage,
  LocalCampaignCheckpointStore,
} from "../src/index.js";
import type { CampaignCheckpointSnapshot, PublishIndex } from "../src/index.js";

const packageIndex: PublishIndex = {
  phase: "PRIMES",
  packages: [
    {
      packageId: 1,
      filename: "primes-pack-000001.zip",
      sha256: "a".repeat(64),
      sizeBytes: 128,
      firstLogicalBlock: 0,
      lastLogicalBlock: 9,
      blockSize: 10,
      blockCount: 10,
      generatorVersion: "1.0.0",
      wheelVersion: "1.0.0",
      publishedAt: "2026-11-06T00:00:00.000Z",
    },
  ],
};

const archive = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const archivePath = "campaigns/camp-1/recovery/bundle.zip";

function buildSnapshot(overrides: Partial<CampaignCheckpointSnapshot> = {}): CampaignCheckpointSnapshot {
  return {
    schemaVersion: "1.0.0",
    kind: "campaign-checkpoint",
    campaignId: "camp-1",
    sequence: 1,
    createdAt: "2026-11-06T00:00:00.000Z",
    phase: "PRIMES",
    jobId: "job-1",
    jobType: "PRIME_SEARCH",
    lastPublishedPackageId: 1,
    lastPublishedLogicalBlock: 10,
    nextLogicalBlockToPublish: 11,
    highestVerifiedResultBlock: 12,
    jobState: { blocks: [1, 2, 3] },
    packageIndex,
    artifact: {
      kind: "RECOVERY_RESULTS_ARCHIVE",
      path: archivePath,
      sha256: createHash("sha256").update(archive).digest("hex"),
      sizeBytes: archive.byteLength,
    },
    unpublishedResultBlocks: [12],
    ...overrides,
  };
}

async function createStore() {
  const dir = await mkdtemp(join(tmpdir(), "campaign-checkpoint-test-"));
  const storage = new LocalArtifactStorage(dir);
  return new LocalCampaignCheckpointStore(storage);
}

describe("LocalCampaignCheckpointStore", () => {
  it("getCheckpoint devuelve null cuando la campaña no tiene checkpoint", async () => {
    const store = await createStore();
    await expect(store.getCheckpoint("camp-1")).resolves.toBeNull();
  });

  it("propaga fallos de lectura del puntero que no sean ausencia", async () => {
    const storage = {
      load: async () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }); },
    };
    const store = new LocalCampaignCheckpointStore(storage as unknown as import("../src/index.js").ArtifactStorage);

    await expect(store.getCheckpoint("camp-1")).rejects.toMatchObject({ code: "EACCES" });
  });

  it("no trata errores de metadata como rutas inmutables libres", async () => {
    const storage = {
      load: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
      getMetadata: async () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }); },
      saveAt: async () => { throw new Error("must not write"); },
    };
    const store = new LocalCampaignCheckpointStore(storage as unknown as import("../src/index.js").ArtifactStorage);

    await expect(store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath }))
      .rejects.toMatchObject({ code: "EACCES" });
  });

  it("publishCheckpoint persiste artefacto, snapshot y puntero; getCheckpoint los lee", async () => {
    const store = await createStore();
    const result = await store.publishCheckpoint({
      snapshot: buildSnapshot(),
      archive,
      archivePath,
    });
    expect(result.alreadyPublished).toBe(false);
    expect(result.snapshotPath).toBe(
      "campaigns/camp-1/state/snapshots/checkpoint-000001.json"
    );

    const checkpoint = await store.getCheckpoint("camp-1");
    expect(checkpoint).not.toBeNull();
    if (!checkpoint) throw new Error("Expected a published checkpoint.");
    const { pointer, snapshot } = checkpoint;
    expect(pointer.sequence).toBe(1);
    expect(pointer.snapshotPath).toBe(result.snapshotPath);
    expect(pointer.snapshotSha256).toBe(result.snapshotSha256);
    expect(snapshot.campaignId).toBe("camp-1");
    expect(snapshot.artifact.path).toBe(archivePath);
  });

  it("publishCheckpoint es idempotente con la misma secuencia y contenido", async () => {
    const store = await createStore();
    await store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath });
    const result = await store.publishCheckpoint({
      snapshot: buildSnapshot(),
      archive,
      archivePath,
    });
    expect(result.alreadyPublished).toBe(true);
  });

  it("rechaza republicar la misma secuencia con contenido diferente", async () => {
    const store = await createStore();
    await store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath });
    await expect(
      store.publishCheckpoint({
        snapshot: buildSnapshot({ sequence: 1, createdAt: "2026-11-06T01:00:00.000Z" }),
        archive,
        archivePath,
      })
    ).rejects.toMatchObject({ code: "CHECKPOINT_SEQUENCE_CONFLICT" });
  });

  it("rechaza una secuencia que no avanza respecto a latest", async () => {
    const store = await createStore();
    await store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath });
    await expect(
      store.publishCheckpoint({
        snapshot: buildSnapshot({ sequence: 0 }),
        archive,
        archivePath,
      })
    ).rejects.toMatchObject({ code: "CHECKPOINT_INVALID" });
  });

  it("rechaza un snapshot cuyo artefacto no coincide con el hash", async () => {
    const store = await createStore();
    await expect(
      store.publishCheckpoint({
        snapshot: buildSnapshot({
          artifact: {
            kind: "RECOVERY_RESULTS_ARCHIVE",
            path: archivePath,
            sha256: "b".repeat(64),
            sizeBytes: archive.byteLength,
          },
        }),
        archive,
        archivePath,
      })
    ).rejects.toMatchObject({ name: "CampaignCheckpointError", code: "CHECKPOINT_INVALID" });
  });

  it("rechaza un snapshot con contrato inválido", async () => {
    const store = await createStore();
    await expect(
      store.publishCheckpoint({
        snapshot: buildSnapshot({ kind: "otra-cosa" as never }),
        archive,
        archivePath,
      })
    ).rejects.toMatchObject({ code: "CHECKPOINT_INVALID" });
  });

  it("rechaza un puntero corrupto en latest.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "campaign-checkpoint-corrupt"));
    const storage = new LocalArtifactStorage(dir);
    await storage.saveAt(
      { id: "latest", path: "campaigns/camp-1/state/latest.json" },
      { schemaVersion: "2.0.0" },
      { type: "campaign-checkpoint-latest", version: "1.0.0" }
    );
    const store = new LocalCampaignCheckpointStore(storage);
    await expect(store.getCheckpoint("camp-1")).rejects.toMatchObject({
      code: "CHECKPOINT_INVALID",
    });
  });
});
