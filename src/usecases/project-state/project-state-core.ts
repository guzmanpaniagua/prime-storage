import type { ArtifactReference, ArtifactStorage } from "../../contracts/artifact-storage.js";
import { ProjectStateError } from "./project-state-error.js";
import type { ProjectState } from "./project-state-types.js";

/**
 * Referencia fija del documento de estado del proyecto.
 * Debe coincidir exactamente con la ruta histórica del sistema (raíz del
 * repositorio): project-phases.json (issue 37.6).
 */
const PROJECT_STATE_ID = "project-state";
const PROJECT_STATE_PATH = "project-phases.json";

export const projectStateReference: ArtifactReference = {
  id: PROJECT_STATE_ID,
  path: PROJECT_STATE_PATH,
};

export async function loadProjectState(
  storage: ArtifactStorage
): Promise<ProjectState | null> {
  let content: unknown;
  try {
    content = await storage.load(projectStateReference);
  } catch {
    // No existe todavía: null, no es un error.
    return null;
  }

  if (
    !content ||
    typeof content !== "object" ||
    !Array.isArray((content as ProjectState).phases) ||
    !Array.isArray((content as ProjectState).audit)
  ) {
    throw new ProjectStateError(
      "PHASES_INVALID",
      "The project state document has an invalid structure."
    );
  }

  return content as ProjectState;
}

export async function persistProjectState(
  storage: ArtifactStorage,
  state: ProjectState
): Promise<void> {
  await storage.saveAt(projectStateReference, { phases: state.phases, audit: state.audit }, {
    type: "project-state",
    version: "1.0.0",
  });
}
