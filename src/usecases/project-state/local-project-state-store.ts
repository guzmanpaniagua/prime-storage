import type { ArtifactStorage } from "../../contracts/artifact-storage.js";
import {
  loadProjectState,
  persistProjectState,
} from "./project-state-core.js";
import type { ProjectStateStore } from "./project-state-store.js";
import type { ProjectState } from "./project-state-types.js";

export class LocalProjectStateStore implements ProjectStateStore {
  private readonly storage: ArtifactStorage;

  constructor(storage: ArtifactStorage) {
    this.storage = storage;
  }

  async getProjectState(): Promise<ProjectState | null> {
    return loadProjectState(this.storage);
  }

  async saveProjectState(state: ProjectState): Promise<void> {
    await persistProjectState(this.storage, state);
  }
}
