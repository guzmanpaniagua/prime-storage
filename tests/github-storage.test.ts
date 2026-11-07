import { describe, expect, it } from "vitest";
import type { ArtifactStorage } from "../src/index.js";
import {
  FflateZipService,
  GithubArtifactStorage,
} from "../src/index.js";

const config = {
  owner: "acme",
  repository: "prime-storage",
  branch: "main",
  token: "test-token",
};

function makeCommitFetchRecorder(
  calls: Array<{ url: string; body?: string }>
): typeof fetch {
  return (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const requestInit = init ?? {};
    const url = String(input);
    const method = requestInit.method ?? "GET";
    calls.push({
      url,
      body: typeof requestInit.body === "string" ? requestInit.body : undefined,
    });

    if (url.endsWith("/git/ref/heads/main")) {
      return new Response(JSON.stringify({ object: { sha: "parent-commit" } }), { status: 200 });
    }
    if (url.includes("/git/commits/parent-commit")) {
      return new Response(JSON.stringify({ tree: { sha: "parent-tree" } }), { status: 200 });
    }
    if (url.endsWith("/git/blobs")) {
      return new Response(JSON.stringify({ sha: `blob-${calls.length}` }), { status: 201 });
    }
    if (url.endsWith("/git/trees")) {
      return new Response(JSON.stringify({ sha: "new-tree" }), { status: 201 });
    }
    if (url.endsWith("/git/commits") && method === "POST") {
      return new Response(JSON.stringify({ sha: "new-commit" }), { status: 201 });
    }
    if (url.endsWith("/git/refs/heads/main") && method === "PATCH") {
      return new Response(JSON.stringify({ object: { sha: "new-commit" } }), { status: 200 });
    }
    return new Response(null, { status: 500 });
  }) as typeof fetch;
}

function createSaveLoadStorage(): {
  fetchImpl: typeof fetch;
  storedDocuments: unknown[];
} {
  const storedDocuments: unknown[] = [];
  const commitRecorder = makeCommitFetchRecorder([]);
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const url = String(input);
    if (url.endsWith("/git/blobs") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { content?: string };
      storedDocuments.push(
        JSON.parse(Buffer.from(body.content ?? "", "base64").toString("utf-8"))
      );
      return new Response(JSON.stringify({ sha: `blob-${storedDocuments.length}` }), { status: 201 });
    }
    if (url.includes("/contents/")) {
      const match = storedDocuments.find(
        (doc) =>
          typeof doc === "object" &&
          doc !== null &&
          url.includes((doc as { reference?: { path?: string } }).reference?.path ?? "###")
      );
      if (match) {
        return new Response(JSON.stringify(match, null, 2), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }
    return commitRecorder(input, init);
  }) as typeof fetch;
  return { fetchImpl, storedDocuments };
}

describe("GithubArtifactStorage", () => {
  it("can be instantiated and implements ArtifactStorage", () => {
    const storage = new GithubArtifactStorage({
      owner: "acme",
      repository: "prime-storage",
      branch: "main",
      token: "test-token",
    });

    const asStorage: ArtifactStorage = storage;
    expect(asStorage).toBeDefined();
  });

  it("getMetadata returns the exact metadata saved by save()", async () => {
    const savedDocument = {
      reference: { id: "abc", path: "artifacts/abc.json" },
      metadata: { type: "prime", version: "2.0.0" },
      contentType: "json",
      data: { primes: [2, 3, 5] },
    };
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/contents/artifacts/abc.json")) {
        return new Response(JSON.stringify(savedDocument, null, 2), { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const storage = new GithubArtifactStorage(
      {
        owner: "acme",
        repository: "prime-storage",
        branch: "main",
        token: "test-token",
      },
      fetchImpl
    );

    const metadata = await storage.getMetadata({
      id: "abc",
      path: "artifacts/abc.json",
    });

    expect(metadata).toEqual({ type: "prime", version: "2.0.0" });
  });

  it("loads a persisted binary document larger than the Contents API JSON limit using raw bytes", async () => {
    const bytes = new Uint8Array(800 * 1024).fill(37);
    const rawDocument = JSON.stringify({
      reference: { id: "large", path: "artifacts/large.json" },
      metadata: { type: "large-archive", version: "1.0.0" },
      contentType: "binary",
      data: Buffer.from(bytes).toString("base64"),
    }, null, 2);
    expect(Buffer.byteLength(rawDocument)).toBeGreaterThan(1_000_000);

    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Accept")).toBe("application/vnd.github.raw+json");
      return new Response(rawDocument, { status: 200 });
    }) as typeof fetch;
    const storage = new GithubArtifactStorage(config, fetchImpl);

    await expect(storage.load({ id: "large", path: "artifacts/large.json" })).resolves.toEqual(bytes);
  });

  it("getMetadata throws GITHUB_ARTIFACT_NOT_FOUND when the file is missing", async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 404 })) as typeof fetch;
    const storage = new GithubArtifactStorage(
      {
        owner: "acme",
        repository: "prime-storage",
        branch: "main",
        token: "test-token",
      },
      fetchImpl
    );

    await expect(storage.getMetadata({ id: "abc", path: "artifacts/abc.json" })).rejects.toMatchObject({
      code: "GITHUB_ARTIFACT_NOT_FOUND",
    });
  });

  it("load uses github-client and maps 404 to GITHUB_FILE_NOT_FOUND", async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 404 })) as typeof fetch;
    const storage = new GithubArtifactStorage(
      {
        owner: "acme",
        repository: "prime-storage",
        branch: "main",
        token: "test-token",
      },
      fetchImpl
    );

    await expect(storage.load({ id: "abc", path: "store/abc" })).rejects.toMatchObject({
      code: "GITHUB_ARTIFACT_NOT_FOUND",
    });
  });
});

describe("GithubArtifactStorage.save", () => {
  it("returns a valid reference and commits exactly one file with reference, metadata and data", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const fetchImpl = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const requestInit = init ?? {};
      const url = String(input);
      const method = requestInit.method ?? "GET";
      calls.push({
        url,
        method,
        body: typeof requestInit.body === "string" ? requestInit.body : undefined,
      });

      if (url.endsWith("/git/ref/heads/main")) {
        return new Response(JSON.stringify({ object: { sha: "parent-commit" } }), { status: 200 });
      }
      if (url.includes("/git/commits/parent-commit")) {
        return new Response(JSON.stringify({ tree: { sha: "parent-tree" } }), { status: 200 });
      }
      if (url.endsWith("/git/blobs")) {
        return new Response(JSON.stringify({ sha: `blob-${calls.length}` }), { status: 201 });
      }
      if (url.endsWith("/git/trees")) {
        return new Response(JSON.stringify({ sha: "new-tree" }), { status: 201 });
      }
      if (url.endsWith("/git/commits") && method === "POST") {
        return new Response(JSON.stringify({ sha: "new-commit" }), { status: 201 });
      }
      if (url.endsWith("/git/refs/heads/main") && method === "PATCH") {
        return new Response(JSON.stringify({ object: { sha: "new-commit" } }), { status: 200 });
      }
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    const storage = new GithubArtifactStorage(
      {
        owner: "acme",
        repository: "prime-storage",
        branch: "main",
        token: "test-token",
      },
      fetchImpl
    );

    const metadata = { type: "prime", version: "1.0.0" };
    const data = { primes: [2, 3, 5, 7] };

    const reference = await storage.save(data, metadata);

    expect(reference.id).toBeTruthy();
    expect(reference.path).toBe(`artifacts/${reference.id}.json`);

    const blobCalls = calls.filter((call) => call.url.includes("/git/blobs"));
    expect(blobCalls).toHaveLength(1);

    const document = JSON.parse(
      Buffer.from(blobCalls[0]?.body ?? "{}", "utf-8").toString("utf-8")
    );
    expect(document.content).toBeDefined();
    const payload = JSON.parse(
      Buffer.from(
        JSON.parse(blobCalls[0]?.body ?? "{}").content,
        "base64"
      ).toString("utf-8")
    );
    expect(payload.reference).toEqual(reference);
    expect(payload.metadata).toEqual(metadata);
    expect(payload.data).toEqual(data);
  });

  it("saves and loads a Uint8Array as a binary document", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const { fetchImpl, storedDocuments } = createSaveLoadStorage();
    const storage = new GithubArtifactStorage(config, fetchImpl);

    const bytes = new Uint8Array([10, 20, 30, 40]);
    const reference = await storage.save(bytes, {
      type: "binary",
      version: "1.0.0",
    });
    const loaded = await storage.load(reference);

    expect(loaded instanceof Uint8Array).toBe(true);
    expect(Array.from(loaded as Uint8Array)).toEqual(Array.from(bytes));

    const payload = storedDocuments[0] as {
      contentType: string;
      data: string;
    };
    expect(payload.contentType).toBe("binary");
    expect(typeof payload.data).toBe("string");
  });

  it("round-trips a ZIP produced by ZipService", async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const zipService = new FflateZipService();
    const payload = { primes: [2, 3, 5, 7, 11], label: "package-50" };
    const zip = zipService.compressJson(payload);

    const { fetchImpl, storedDocuments } = createSaveLoadStorage();
    const storage = new GithubArtifactStorage(config, fetchImpl);

    const reference = await storage.save(zip, {
      type: "primes-package",
      version: "1.0.0",
    });
    const loaded = await storage.load(reference);
    const decompressed = zipService.decompressJson<Record<string, unknown>>(
      loaded as Uint8Array
    );

    expect(loaded instanceof Uint8Array).toBe(true);
    expect(decompressed).toEqual(payload);
    expect(storedDocuments).toHaveLength(1);
  });
});

describe("GithubArtifactStorage.load", () => {
  function createStorageForDocument(
    document: unknown,
    status = 200
  ): GithubArtifactStorage {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (status === 200 && url.includes("/contents/artifacts/abc.json")) {
        return new Response(
          typeof document === "string" ? document : JSON.stringify(document, null, 2),
          { status: 200 }
        );
      }
      return new Response(null, { status: status === 200 ? 404 : status });
    }) as typeof fetch;

    return new GithubArtifactStorage(
      {
        owner: "acme",
        repository: "prime-storage",
        branch: "main",
        token: "test-token",
      },
      fetchImpl
    );
  }

  it("returns only the data of a saved JSON document", async () => {
    const stored = {
      reference: { id: "abc", path: "artifacts/abc.json" },
      metadata: { type: "prime", version: "1.0.0" },
      contentType: "json",
      data: { primes: [2, 3, 5, 7] },
    };
    const storage = createStorageForDocument(stored);

    const data = await storage.load({ id: "abc", path: "artifacts/abc.json" });

    expect(data).toEqual({ primes: [2, 3, 5, 7] });
  });

  it("returns a reconstructed Uint8Array for a binary document", async () => {
    const bytes = [9, 8, 7, 6, 5, 4];
    const stored = {
      reference: { id: "abc", path: "artifacts/abc.json" },
      metadata: { type: "zip", version: "1.0.0" },
      contentType: "binary",
      data: Buffer.from(new Uint8Array(bytes)).toString("base64"),
    };
    const storage = createStorageForDocument(stored);

    const data = await storage.load({ id: "abc", path: "artifacts/abc.json" });

    expect(data instanceof Uint8Array).toBe(true);
    expect(Array.from(data as Uint8Array)).toEqual(bytes);
  });

  it("throws GITHUB_ARTIFACT_NOT_FOUND when the file does not exist", async () => {
    const storage = createStorageForDocument(null, 404);

    await expect(storage.load({ id: "abc", path: "artifacts/abc.json" })).rejects.toMatchObject({
      code: "GITHUB_ARTIFACT_NOT_FOUND",
    });
  });

  it("throws GITHUB_ARTIFACT_UNEXPECTED_STRUCTURE when the content is not valid JSON", async () => {
    const storage = createStorageForDocument("esto no es json {");

    await expect(storage.load({ id: "abc", path: "artifacts/abc.json" })).rejects.toMatchObject({
      code: "GITHUB_ARTIFACT_UNEXPECTED_STRUCTURE",
    });
  });

  it("throws GITHUB_ARTIFACT_UNEXPECTED_STRUCTURE when the document is malformed", async () => {
    const storage = createStorageForDocument({ foo: "bar" });

    await expect(storage.load({ id: "abc", path: "artifacts/abc.json" })).rejects.toMatchObject({
      code: "GITHUB_ARTIFACT_UNEXPECTED_STRUCTURE",
    });
  });
});
