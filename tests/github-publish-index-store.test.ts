import { describe, expect, it } from "vitest";
import {
  GithubArtifactStorage,
  GithubPublishIndexStore,
} from "../src/index.js";
import type { PublishPackageInput } from "../src/index.js";

const config = {
  owner: "acme",
  repository: "prime-storage",
  branch: "main",
  token: "test-token",
};

/**
 * Fetch simulado que emula el flujo de commits de la GitHub API:
 * - GET   /git/ref/heads/<branch>   → base commit
 * - GET   /git/commits/<sha>        → commit padre (tree)
 * - POST  /git/blobs                → crea blobs (guarda el contenido por sha)
 * - POST  /git/trees                → crea el árbol y "almacena" los ficheros
 * - POST  /git/commits              → crea el commit
 * - PATCH /git/refs/heads/<branch>  → actualiza la rama
 * - GET   /contents/<path>          → lectura de ficheros ya "almacenados"
 */
function createMockFetch(): { fetchImpl: typeof fetch; getCommitCount: () => number } {
  const storedFiles = new Map<string, string>();
  const blobContents = new Map<string, string>();
  let commitCount = 0;

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
      return new Response(content, { status: 200 });
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
      commitCount += 1;
      return new Response(JSON.stringify({ sha: "new-commit" }), { status: 201 });
    }

    if (method === "PATCH" && url.includes("/git/refs/")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;

  return { fetchImpl, getCommitCount: () => commitCount };
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

describe("GithubPublishIndexStore", () => {
  it("registers a package and reads the index back", async () => {
    const { fetchImpl, getCommitCount } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubPublishIndexStore(storage);

    const result = await store.registerPublishedPackage(makeInput());

    expect(result.status).toBe("registered");
    expect(result.entry.packageId).toBe(1);
    expect(result.entry.filename).toBe("primes-pack-000001.zip");
    expect(result.entry.sha256).toMatch(/^[a-f0-9]{64}$/);

    const packages = await store.getPublishedPackages("PRIMES");
    expect(packages).toHaveLength(1);
    expect(packages[0]?.packageId).toBe(1);
    expect(getCommitCount()).toBe(1);
  });

  it("includes related checkpoint artifacts in the package commit", async () => {
    const { fetchImpl, getCommitCount } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubPublishIndexStore(storage);
    const checkpointRef = {
      id: "campaign-latest",
      path: "campaigns/camp-1/state/latest.json",
    };

    await store.registerPublishedPackage({
      ...makeInput(),
      additionalArtifacts: [{
        reference: checkpointRef,
        data: { sequence: 1 },
        metadata: { type: "campaign-checkpoint-latest", version: "1.0.0" },
      }],
    });

    expect(getCommitCount()).toBe(1);
    await expect(storage.load(checkpointRef)).resolves.toEqual({ sequence: 1 });
  });

  it("reads a package by packageId", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubPublishIndexStore(storage);

    await store.registerPublishedPackage(makeInput({ packageId: 3 }));

    const entry = await store.getPublishedPackage("PRIMES", 3);
    expect(entry).not.toBeNull();
    expect(entry?.packageId).toBe(3);
  });

  it("recovers the published ZIP with integrity verification", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubPublishIndexStore(storage);

    const archive = new Uint8Array([5, 10, 15, 20]);
    await store.registerPublishedPackage(makeInput({ archive }));

    const recovered = await store.getPublishedArchive("PRIMES", 1);

    expect(recovered).not.toBeNull();
    expect(Array.from(recovered as Uint8Array)).toEqual(Array.from(archive));
  });

  it("is idempotent for the same package", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubPublishIndexStore(storage);

    const input = makeInput();
    const first = await store.registerPublishedPackage(input);
    const second = await store.registerPublishedPackage(input);

    expect(first.status).toBe("registered");
    expect(second.status).toBe("already-published");
  });
});
