import { GithubStorageError } from "./github-errors.js";
import type { GithubFile } from "./github-file.js";
import type { GithubStorageConfig } from "./github-storage-config.js";

export class GithubClient {
  private readonly owner: string;
  private readonly repository: string;
  private readonly branch: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: GithubStorageConfig,
    fetchImpl: typeof fetch = fetch
  ) {
    this.owner = config.owner;
    this.repository = config.repository;
    this.branch = config.branch;
    this.token = config.token;
    this.fetchImpl = fetchImpl;
  }

  private isConfigured(): boolean {
    return Boolean(this.owner && this.repository && this.branch && this.token);
  }

  private async request(
    path: string,
    init: RequestInit,
    allowNotFound = false
  ): Promise<Response> {
    if (!this.isConfigured()) {
      throw new GithubStorageError(
        503,
        "GITHUB_NOT_CONFIGURED",
        "GithubStorageConfig is missing owner, repository, branch or token."
      );
    }
    let response: Response;
    try {
      const base = `https://api.github.com/repos/${encodeURIComponent(
        this.owner
      )}/${encodeURIComponent(this.repository)}`;
      response = await this.fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new GithubStorageError(
        503,
        "GITHUB_TRANSIENT_ERROR",
        "Could not connect to GitHub; the artifact is kept for retry."
      );
    }
    if (allowNotFound && response.status === 404) return response;
    return response;
  }

  private async apiError(
    response: Response,
    fallback: string
  ): Promise<GithubStorageError> {
    if (response.status === 429 || response.status >= 500) {
      return new GithubStorageError(
        503,
        "GITHUB_TRANSIENT_ERROR",
        "GitHub is temporarily unavailable; the artifact is kept for retry."
      );
    }
    if (response.status === 403) {
      const rateLimited = response.headers.get("x-ratelimit-remaining") === "0";
      return new GithubStorageError(
        rateLimited ? 503 : 502,
        rateLimited ? "GITHUB_TRANSIENT_ERROR" : "GITHUB_FORBIDDEN",
        rateLimited
          ? "GitHub rate limit reached temporarily; it can be retried."
          : "GitHub rejected access. Check the token and its permissions."
      );
    }
    if (response.status === 404) {
      return new GithubStorageError(
        502,
        "GITHUB_NOT_FOUND",
        "The configured repository, branch or resource was not found on GitHub."
      );
    }
    return new GithubStorageError(502, "GITHUB_REQUEST_FAILED", fallback);
  }

  async fileExists(path: string): Promise<boolean> {
    const response = await this.request(
      `/contents/${path}?ref=${encodeURIComponent(this.branch)}`,
      { method: "GET" },
      true
    );
    if (response.status === 404) return false;
    if (!response.ok) {
      throw await this.apiError(
        response,
        "Could not check the file on GitHub."
      );
    }
    return true;
  }

  async readFile(path: string): Promise<string | null> {
    const response = await this.request(
      `/contents/${path}?ref=${encodeURIComponent(this.branch)}`,
      { method: "GET" },
      true
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw await this.apiError(response, "Could not read the file from GitHub.");
    }
    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("content" in payload) ||
      typeof (payload as { content: unknown }).content !== "string" ||
      (payload as { encoding?: unknown }).encoding !== "base64"
    ) {
      throw new GithubStorageError(
        502,
        "GITHUB_FILE_INVALID",
        "GitHub returned a file with an unexpected format."
      );
    }
    const content = (payload as { content: string }).content;
    return Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const response = await this.request(
      `/contents/${path}?ref=${encodeURIComponent(this.branch)}`,
      {
        method: "GET",
        headers: { Accept: "application/vnd.github.raw+json" },
      },
      true
    );
    if (response.status === 404) {
      throw new GithubStorageError(
        404,
        "GITHUB_FILE_NOT_FOUND",
        "The artifact was not found on GitHub."
      );
    }
    if (!response.ok) {
      throw await this.apiError(
        response,
        "Could not download the binary artifact from GitHub."
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async commitFiles(files: GithubFile[], message: string): Promise<void> {
    const ref = await this.request(
      `/git/ref/heads/${encodeURIComponent(this.branch)}`,
      { method: "GET" }
    );
    if (!ref.ok) {
      throw await this.apiError(
        ref,
        "Could not read the configured GitHub branch."
      );
    }
    const refPayload: unknown = await ref.json();
    if (
      typeof refPayload !== "object" ||
      refPayload === null ||
      typeof (refPayload as { object?: unknown }).object !== "object" ||
      (refPayload as { object: unknown }).object === null ||
      typeof ((refPayload as { object: { sha?: unknown } }).object).sha !==
        "string"
    ) {
      throw new GithubStorageError(
        502,
        "GITHUB_REF_INVALID",
        "GitHub returned an invalid branch reference."
      );
    }
    const parentSha = (
      refPayload as { object: { sha: string } }
    ).object.sha;

    const commitResponse = await this.request(`/git/commits/${parentSha}`, {
      method: "GET",
    });
    if (!commitResponse.ok) {
      throw await this.apiError(
        commitResponse,
        "Could not read the current GitHub commit."
      );
    }
    const parentPayload: unknown = await commitResponse.json();
    if (
      typeof parentPayload !== "object" ||
      parentPayload === null ||
      !("tree" in parentPayload) ||
      typeof (parentPayload as { tree?: { sha?: unknown } }).tree !== "object" ||
      (parentPayload as { tree: unknown }).tree === null ||
      typeof ((parentPayload as { tree: { sha?: unknown } }).tree).sha !==
        "string"
    ) {
      throw new GithubStorageError(
        502,
        "GITHUB_COMMIT_INVALID",
        "GitHub returned an invalid commit."
      );
    }
    const parentTreeSha = (parentPayload as { tree: { sha: string } }).tree.sha;

    const treeEntries: Array<{
      path: string;
      mode: string;
      type: string;
      sha: string;
    }> = [];
    for (const file of files) {
      const blobResponse = await this.request("/git/blobs", {
        method: "POST",
        body: JSON.stringify({ content: file.base64, encoding: "base64" }),
      });
      if (!blobResponse.ok) {
        throw await this.apiError(
          blobResponse,
          "Could not prepare a file for GitHub."
        );
      }
      const blob: unknown = await blobResponse.json();
      if (
        typeof blob !== "object" ||
        blob === null ||
        typeof (blob as { sha?: unknown }).sha !== "string"
      ) {
        throw new GithubStorageError(
          502,
          "GITHUB_BLOB_INVALID",
          "GitHub returned an invalid blob."
        );
      }
      treeEntries.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: (blob as { sha: string }).sha,
      });
    }

    const treeResponse = await this.request("/git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: parentTreeSha,
        tree: treeEntries,
      }),
    });
    if (!treeResponse.ok) {
      throw await this.apiError(
        treeResponse,
        "Could not create the GitHub commit tree."
      );
    }
    const tree: unknown = await treeResponse.json();
    if (
      typeof tree !== "object" ||
      tree === null ||
      typeof (tree as { sha?: unknown }).sha !== "string"
    ) {
      throw new GithubStorageError(
        502,
        "GITHUB_TREE_INVALID",
        "GitHub returned an invalid tree."
      );
    }
    const treeSha = (tree as { sha: string }).sha;

    const newCommitResponse = await this.request("/git/commits", {
      method: "POST",
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
    });
    if (!newCommitResponse.ok) {
      throw await this.apiError(
        newCommitResponse,
        "Could not create the GitHub commit."
      );
    }
    const newCommit: unknown = await newCommitResponse.json();
    if (
      typeof newCommit !== "object" ||
      newCommit === null ||
      typeof (newCommit as { sha?: unknown }).sha !== "string"
    ) {
      throw new GithubStorageError(
        502,
        "GITHUB_NEW_COMMIT_INVALID",
        "GitHub returned an invalid commit."
      );
    }
    const newCommitSha = (newCommit as { sha: string }).sha;

    const updateResponse = await this.request(
      `/git/refs/heads/${encodeURIComponent(this.branch)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ sha: newCommitSha, force: false }),
      }
    );
    if (!updateResponse.ok) {
      if (updateResponse.status === 409 || updateResponse.status === 422) {
        throw new GithubStorageError(
          503,
          "GITHUB_TRANSIENT_ERROR",
          "The branch changed during publication; the artifact is kept for retry."
        );
      }
      throw await this.apiError(
        updateResponse,
        "Could not update the GitHub branch; it can be retried."
      );
    }
  }
}
