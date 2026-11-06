import type { GithubArtifactStorage } from "../../github/github-artifact-storage.js";
import { loadProjectState, persistProjectState } from "./project-state-core.js";
import type { ProjectStateStore } from "./project-state-store.js";
import type { ProjectState } from "./project-state-types.js";

export class GithubProjectStateStore implements ProjectStateStore {
  private readonly storage: GithubArtifactStorage;

  constructor(storage: GithubArtifactStorage) {
    this.storage = storage;
  }

  async getProjectState(): Promise<ProjectState | null> {
    return loadProjectState(this.storage);
  }

  async saveProjectState(state: ProjectState): Promise<void> {
    await persistProjectState(this.storage, state);
  }
}
