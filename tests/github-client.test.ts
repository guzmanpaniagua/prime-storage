import { beforeEach, describe, expect, it } from "vitest";
import { GithubClient } from "../src/index.js";

type RecordedRequest = {
  url: string;
  method: string;
  body: string | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createFetchRecorder(
  handler: (url: string, init: RequestInit) => Response
): { fetchImpl: typeof fetch; calls: Array<{ url: string; method: string; body?: string }> } {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const requestInit = init ?? {};
    calls.push({
      url: String(input),
      method: requestInit.method ?? "GET",
      body:
        typeof requestInit.body === "string" ? requestInit.body : undefined,
    });
    return handler(String(input), requestInit);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function makeClient(fetchImpl: typeof fetch): GithubClient {
  return new GithubClient(
    {
      owner: "acme",
      repository: "prime-storage",
      branch: "main",
      token: "test-token",
    },
    fetchImpl
  );
}

describe("GithubClient.fileExists", () => {
  it("returns true for 200", async () => {
    const { fetchImpl } = createFetchRecorder(() =>
      new Response(null, { status: 200 })
    );
    const client = makeClient(fetchImpl);

    await expect(client.fileExists("artifacts/prime.json")).resolves.toBe(true);
  });

  it("returns false for 404", async () => {
    const { fetchImpl } = createFetchRecorder(() =>
      new Response(null, { status: 404 })
    );
    const client = makeClient(fetchImpl);

    await expect(client.fileExists("store/missing.json")).resolves.toBe(false);
  });
});

describe("GithubClient.commitFiles", () => {
  it("creates blobs, tree, commit and updates the branch reference", async () => {
    const { fetchImpl, calls } = createFetchRecorder((url, init) => {
      const method = init.method ?? "GET";
      if (url.endsWith("/git/ref/heads/main")) {
        return jsonResponse(200, { object: { sha: "parent-commit-sha" } });
      }
      if (url.includes("/git/commits/parent-commit-sha")) {
        return jsonResponse(200, { tree: { sha: "parent-tree-sha" } });
      }
      if (url.endsWith("/git/blobs") && method === "POST") {
        return jsonResponse(201, { sha: `blob-sha-${calls.length}` });
      }
      if (url.endsWith("/git/trees") && method === "POST") {
        return jsonResponse(201, { sha: "new-tree-sha" });
      }
      if (url.endsWith("/git/commits") && method === "POST") {
        return jsonResponse(201, { sha: "new-commit-sha" });
      }
      if (url.endsWith("/git/refs/heads/main") && method === "PATCH") {
        return jsonResponse(200, { object: { sha: "new-commit-sha" } });
      }
      return new Response(null, { status: 500 });
    });
    const client = makeClient(fetchImpl);

    await expect(
      client.commitFiles(
        [
          { path: "artifacts/prime.json", base64: "eyJhIjoxfQ==" },
          { path: "artifacts/index.json", base64: "e30=" },
        ],
        "Publish artifacts"
      )
    ).resolves.toBeUndefined();

    const requestedUrls = calls.map((call) => call.url);
    expect(requestedUrls.some((url) => url.includes("/git/blobs"))).toBe(true);
    expect(requestedUrls.some((url) => url.includes("/git/trees"))).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.includes("/git/commits") && call.method === "POST"
      )
    ).toBe(true);
    expect(
      calls.some(
        (call) =>
          call.url.includes("/git/refs/heads/main") &&
          call.method === "PATCH"
      )
    ).toBe(true);

    const blobCalls = calls.filter((call) => call.url.includes("/git/blobs"));
    expect(blobCalls).toHaveLength(2);
    expect(blobCalls[0]?.body).toContain("eyJhIjoxfQ==");

    const treeCall = calls.find((call) => call.url.includes("/git/trees"));
    expect(treeCallBody(treeCall)).toContain("parent-tree-sha");

    const refUpdate = calls.find(
      (call) => call.url.includes("/git/refs/heads/") && call.method === "PATCH"
    );
    expect(refUpdate?.body).toContain("new-commit-sha");
  });
});

function treeCallBody(
  call: { body?: string } | undefined
): string {
  return typeof call?.body === "string" ? call.body : "";
}
