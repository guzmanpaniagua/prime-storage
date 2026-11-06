import type { ProjectState } from "./project-state-types.js";

export interface ProjectStateStore {
  getProjectState(): Promise<ProjectState | null>;
  saveProjectState(state: ProjectState): Promise<void>;
}
