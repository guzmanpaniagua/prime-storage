import type { ArtifactContent } from "./artifact-content.js";
import type { ArtifactMetadata } from "./artifact.js";
import type { ArtifactReference } from "./artifact.js";

export interface StoredArtifact {
  reference: ArtifactReference;
  metadata: ArtifactMetadata;
  data: ArtifactContent;
}
