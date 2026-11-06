import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GithubArtifactStorage,
  GithubCampaignCheckpointStore,
} from "../src/index.js";
import type { CampaignCheckpointSnapshot, PublishIndex } from "../src/index.js";

const config = {
  owner: "acme",
  repository: "prime-storage",
  branch: "main",
  token: "test-token",
};

const packageIndex: PublishIndex = {
  phase: "PRIMES",
  packages: [
    {
      packageId: 1,
      filename: "primes-pack-000001.zip",
      sha256: "a".repeat(64),
      sizeBytes: 128,
      itemCount: 10,
      publishedAt: "2026-11-06T00:00:00.000Z",
      version: "1.0.0",
    },
  ],
};

const archive = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
const archivePath = "campaigns/camp-gh/recovery/bundle.zip";

function buildSnapshot(overrides: Partial<CampaignCheckpointSnapshot> = {}): CampaignCheckpointSnapshot {
  return {
    schemaVersion: "1.0.0",
    kind: "campaign-checkpoint",
    campaignId: "camp-gh",
    sequence: 1,
    createdAt: "2026-11-06T00:00:00.000Z",
    phase: "PRIMES",
    jobId: "job-gh",
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

/**
 * Fetch simulado que emula el flujo de commits de la GitHub API
 * (mismo patrón que github-project-state-store.test.ts).
 */
function createMockFetch(): { fetchImpl: typeof fetch } {
  const storedFiles = new Map<string, string>();
  const blobContents = new Map<string, string>();

  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (method === "GET" && url.includes("/contents/")) {
      const rawPath = url.split("/contents/")[1] ?? "";
      const path = decodeURIComponent(rawPath.split("?")[0]);
      const content = storedFiles.get(path);
      if (content === undefined) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      return new Response(
        JSON.stringify({
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        }),
        { status: 200 }
      );
    }

    if (method === "GET" && url.includes("/git/ref/")) {
      return new Response(
        JSON.stringify({ object: { sha: "base-commit" } }),
        { status: 200 }
      );
    }

    if (method === "GET" && url.includes("/git/commits/")) {
      return new Response(
        JSON.stringify({ tree: { sha: "base-tree" } }),
        { status: 200 }
      );
    }

    if (method === "POST" && url.includes("/git/blobs")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const sha = `blob-${blobContents.size}`;
      blobContents.set(sha, body.content);
      return new Response(JSON.stringify({ sha }), { status: 201 });
    }

    if (method === "POST" && url.includes("/git/trees")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      for (const item of body.tree ?? []) {
        const base64 = blobContents.get(item.sha) ?? "";
        storedFiles.set(item.path, Buffer.from(base64, "base64").toString("utf-8"));
      }
      return new Response(JSON.stringify({ sha: "new-tree" }), { status: 201 });
    }

    if (method === "POST" && url.includes("/git/commits")) {
      return new Response(JSON.stringify({ sha: "new-commit" }), { status: 201 });
    }

    if (method === "PATCH" && url.includes("/git/refs/")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;

  return { fetchImpl };
}

describe("GithubCampaignCheckpointStore", () => {
  it("getCheckpoint devuelve null cuando la campaña no tiene checkpoint", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubCampaignCheckpointStore(storage);

    await expect(store.getCheckpoint("camp-gh")).resolves.toBeNull();
  });

  it("publishCheckpoint publica y getCheckpoint lee el checkpoint", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubCampaignCheckpointStore(storage);

    const result = await store.publishCheckpoint({
      snapshot: buildSnapshot(),
      archive,
      archivePath,
    });
    expect(result.alreadyPublished).toBe(false);
    expect(result.snapshotPath).toBe(
      "campaigns/camp-gh/state/snapshots/checkpoint-000001.json"
    );

    const { pointer, snapshot } = await store.getCheckpoint("camp-gh");
    expect(pointer.sequence).toBe(1);
    expect(pointer.snapshotPath).toBe(result.snapshotPath);
    expect(pointer.snapshotSha256).toBe(result.snapshotSha256);
    expect(snapshot.campaignId).toBe("camp-gh");
    expect(snapshot.artifact.path).toBe(archivePath);
  });

  it("publishCheckpoint es idempotente con la misma secuencia y contenido", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubCampaignCheckpointStore(storage);

    await store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath });
    const result = await store.publishCheckpoint({
      snapshot: buildSnapshot(),
      archive,
      archivePath,
    });
    expect(result.alreadyPublished).toBe(true);
  });

  it("rechaza republicar la misma secuencia con contenido diferente", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubCampaignCheckpointStore(storage);

    await store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath });
    await expect(
      store.publishCheckpoint({
        snapshot: buildSnapshot({ sequence: 1, createdAt: "2026-11-06T01:00:00.000Z" }),
        archive,
        archivePath,
      })
    ).rejects.toMatchObject({ code: "CHECKPOINT_SEQUENCE_CONFLICT" });
  });

  it("rechaza un snapshot cuyo artefacto no coincide con el hash", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubCampaignCheckpointStore(storage);

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
    ).rejects.toMatchObject({ code: "CHECKPOINT_INVALID" });
  });

  it("rechaza un snapshot con hash de snapshot distinto al del puntero (hash mismatch)", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubCampaignCheckpointStore(storage);

    // Publicar un checkpoint válido.
    await store.publishCheckpoint({ snapshot: buildSnapshot(), archive, archivePath });

    // Corromper el snapshot almacenado (cambia su contenido → hash mismatch).
    const snapshotPath = "campaigns/camp-gh/state/snapshots/checkpoint-000001.json";
    await storage.saveAt(
      { id: "snapshot", path: snapshotPath },
      { schemaVersion: "1.0.0", kind: "corrupted" },
      { type: "campaign-checkpoint-snapshot", version: "1.0.0" }
    );

    await expect(store.getCheckpoint("camp-gh")).rejects.toMatchObject({
      name: "CampaignCheckpointError",
      code: "CHECKPOINT_HASH_MISMATCH",
    });
  });
});
