import { describe, expect, it } from "vitest";
import type {
  GithubArtifactLocation,
  GithubArtifactMetadata,
  GithubStorageConfig,
} from "../src/index.js";

describe("github types", () => {
  it("exports compile and are assignable", () => {
    const config: GithubStorageConfig = {
      owner: "acme",
      repository: "prime-storage",
      branch: "main",
      token: "test-token",
    };
    const location: GithubArtifactLocation = {
      path: "artifacts/prime.json",
    };
    const withOptionals: GithubArtifactLocation = {
      path: "artifacts/prime.json",
      sha: "abc123",
      downloadUrl: "https://example.com/prime.json",
    };
    const metadata: GithubArtifactMetadata = {
      storageType: "github",
      owner: config.owner,
      repository: config.repository,
      branch: config.branch,
      path: location.path,
    };

    expect(config.owner).toBe("acme");
    expect(location.sha).toBeUndefined();
    expect(withOptionals.sha).toBe("abc123");
    expect(metadata.storageType).toBe("github");
  });
});
