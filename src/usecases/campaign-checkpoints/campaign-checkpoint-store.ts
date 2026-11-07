import type {
  CampaignArtifactReference,
  CampaignCheckpointPointer,
  CampaignCheckpointSnapshot,
} from "./campaign-checkpoint-types.js";

export interface CampaignCheckpointStore {
  /** Lists campaign directories available in the backing GitHub repository. */
  listCampaignIds?(): Promise<string[]>;

  /**
   * Devuelve el puntero y snapshot vigentes de una campaña,
   * o `null` si la campaña no tiene checkpoint.
   * Valida contratos e integridad (hashes, cursores, referencias).
   */
  getCheckpoint(campaignId: string): Promise<{
    pointer: CampaignCheckpointPointer;
    snapshot: CampaignCheckpointSnapshot;
  } | null>;

  /** Loads and verifies the binary artifact referenced by a validated snapshot. */
  getArtifact?(reference: CampaignArtifactReference): Promise<Uint8Array>;

  /**
   * Publica un checkpoint: artefacto inmutable + snapshot inmutable +
   * puntero latest. Idempotente si la secuencia ya existe con el mismo
   * contenido (devuelve alreadyPublished = true).
   */
  publishCheckpoint(input: {
    snapshot: CampaignCheckpointSnapshot;
    archive: Uint8Array;
    archivePath: string;
  }): Promise<{
    pointer: CampaignCheckpointPointer;
    snapshotPath: string;
    snapshotSha256: string;
    alreadyPublished: boolean;
  }>;
}
