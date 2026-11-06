import type { CampaignCheckpointPointer, CampaignCheckpointSnapshot } from "./campaign-checkpoint-types.js";

export interface CampaignCheckpointStore {
  /**
   * Devuelve el puntero y snapshot vigentes de una campaña,
   * o `null` si la campaña no tiene checkpoint.
   * Valida contratos e integridad (hashes, cursores, referencias).
   */
  getCheckpoint(campaignId: string): Promise<{
    pointer: CampaignCheckpointPointer;
    snapshot: CampaignCheckpointSnapshot;
  } | null>;

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
