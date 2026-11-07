export interface GithubStorageConfig {
  owner: string;
  repository: string;
  branch: string;
  token: string;
  /** Optional GitHub-compatible API base URL, primarily for controlled tests. */
  apiBaseUrl?: string;
}
