/**
 * Modelos públicos para Campaign Checkpoints.
 * Copia exacta del modelo de datos de docs/checkPointTypes.ts (monolito),
 * representando los artefactos persistidos:
 *
 *   campaigns/<campaignId>/
 *     state/latest.json                          ← CampaignCheckpointPointer
 *     state/snapshots/checkpoint-<sequence>.json ← CampaignCheckpointSnapshot
 *
 * Issue 40a: solo el modelo de datos, sin validaciones, stores ni lógica GitHub.
 */
import type { PhaseType, PublishIndex, PublishIndexEntry } from "../publish-index/publish-index-types.js";

/** Input file shape used when validating checkpoint artifacts bundled with a package publication. */
export interface PackageCheckpointFile {
  path: string;
  content: string | Uint8Array;
}

/** Package fields required to validate the corresponding immutable checkpoint snapshot. */
export type PackageCheckpointEntry = Pick<
  PublishIndexEntry,
  "packageId" | "filename" | "sha256" | "sizeBytes" | "lastLogicalBlock"
>;

/**
 * Tipos de artefacto que un checkpoint puede referenciar.
 * En el monolito es la unión inline de `CheckpointArtifactReference.kind`.
 */
export type CampaignArtifactKind = "RECOVERY_RESULTS_ARCHIVE" | "PUBLISHED_PACKAGE";

/**
 * Referencia inmutable al artefacto (ZIP) asociado al checkpoint.
 * Equivalente a `CheckpointArtifactReference` del monolito.
 */
export interface CampaignArtifactReference {
  kind: CampaignArtifactKind;
  path: string;
  sha256: string;
  sizeBytes: number;
  packageId?: number;
}

/**
 * Snapshot inmutable de una campaña
 * (`state/snapshots/checkpoint-<sequence>.json`).
 */
export interface CampaignCheckpointSnapshot {
  schemaVersion: "1.0.0";
  kind: "campaign-checkpoint";
  campaignId: string;
  sequence: number;
  createdAt: string;
  phase: PhaseType;
  jobId: string;
  /**
   * Tipo de trabajo de la campaña. En el monolito es `JobType`
   * (domainTypes); aquí se representa como `string` porque el contrato
   * de persistencia solo exige `typeof === 'string'`.
   */
  jobType: string;
  lastPublishedPackageId: number;
  lastPublishedLogicalBlock: number;
  nextLogicalBlockToPublish: number;
  highestVerifiedResultBlock: number;
  jobState: Record<string, unknown>;
  packageIndex: PublishIndex;
  artifact: CampaignArtifactReference;
  unpublishedResultBlocks: number[];
}

/**
 * Puntero vigente de una campaña (`state/latest.json`).
 * Referencia al snapshot vigente por ruta y SHA-256, y comparte con él
 * los cursores de publicación.
 */
export interface CampaignCheckpointPointer {
  schemaVersion: "1.0.0";
  campaignId: string;
  sequence: number;
  snapshotPath: string;
  snapshotSha256: string;
  lastPublishedPackageId: number;
  lastPublishedLogicalBlock: number;
  nextLogicalBlockToPublish: number;
  jobId: string;
  /** Ídem: `JobType` en el monolito, `string` en el contrato de storage. */
  jobType: string;
}
