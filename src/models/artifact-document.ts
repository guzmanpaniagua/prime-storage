import type { ArtifactContent } from "./artifact-content.js";
import type { ArtifactMetadata, ArtifactReference } from "./artifact.js";

export interface ArtifactDocument {
  reference: ArtifactReference;
  metadata: ArtifactMetadata;
  data: ArtifactContent;
}
