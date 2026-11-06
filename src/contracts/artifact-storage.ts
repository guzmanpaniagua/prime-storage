export interface ArtifactMetadata {
  type: string;
  version: string;
}

export interface ArtifactReference {
  id: string;
  path: string;
}

export type ArtifactContent = unknown | Uint8Array;

export interface ArtifactStorage {
  save(
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference>;
  saveAt(
    reference: ArtifactReference,
    data: ArtifactContent,
    metadata: ArtifactMetadata
  ): Promise<ArtifactReference>;
  load(reference: ArtifactReference): Promise<ArtifactContent>;
  getMetadata(reference: ArtifactReference): Promise<ArtifactMetadata>;
}
