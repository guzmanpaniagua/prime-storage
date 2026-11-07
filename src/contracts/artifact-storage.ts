export interface ArtifactMetadata {
  type: string;
  version: string;
}

export interface ArtifactReference {
  id: string;
  path: string;
}

export type ArtifactContent = unknown | Uint8Array;

export interface ArtifactWrite {
  reference: ArtifactReference;
  data: ArtifactContent;
  metadata: ArtifactMetadata;
}

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
  /**
   * Persist several references as one backend operation when supported.
   * Backends without transactional commits may persist the writes sequentially.
   */
  saveManyAt?(
    writes: readonly ArtifactWrite[],
    message?: string
  ): Promise<ArtifactReference[]>;
  load(reference: ArtifactReference): Promise<ArtifactContent>;
  getMetadata(reference: ArtifactReference): Promise<ArtifactMetadata>;
}
