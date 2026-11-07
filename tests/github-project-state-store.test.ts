import { describe, expect, it } from "vitest";
import {
  GithubArtifactStorage,
  GithubProjectStateStore,
} from "../src/index.js";
import type { ProjectState } from "../src/index.js";

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
      return new Response(JSON.stringify({ sha: "new-commit" }), { status: 201 });
    }

    if (method === "PATCH" && url.includes("/git/refs/")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;

  return { fetchImpl };
}

describe("GithubProjectStateStore", () => {
  it("returns null when the project state does not exist", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubProjectStateStore(storage);

    const state = await store.getProjectState();

    expect(state).toBeNull();
  });

  it("saves the state and reads it back", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubProjectStateStore(storage);
    const state: ProjectState = {
      phases: [{ id: "PRIMES", status: "completed" }],
      audit: [{ at: "2026-01-01T00:00:00Z", action: "phase-completed" }],
    };

    await store.saveProjectState(state);
    const loaded = await store.getProjectState();

    expect(loaded).toEqual(state);
  });

  it("throws PHASES_INVALID for a corrupted document", async () => {
    const { fetchImpl } = createMockFetch();
    const storage = new GithubArtifactStorage(config, fetchImpl);
    const store = new GithubProjectStateStore(storage);

    // Escribir un documento con estructura inválida directamente en el storage.
    await storage.saveAt(
      { id: "project-state", path: "project-phases.json" },
      { phases: "no-array" },
      { type: "project-state", version: "1.0.0" }
    );

    await expect(store.getProjectState()).rejects.toMatchObject({
      name: "ProjectStateError",
      code: "PHASES_INVALID",
    });
  });
});
