export type CampaignCheckpointErrorCode =
  | "CHECKPOINT_INVALID"
  | "CHECKPOINT_SEQUENCE_CONFLICT"
  | "CHECKPOINT_POINTER_CONFLICT"
  | "CHECKPOINT_ARTIFACT_CONFLICT"
  | "CHECKPOINT_HASH_MISMATCH";

export class CampaignCheckpointError extends Error {
  readonly code: CampaignCheckpointErrorCode;

  constructor(code: CampaignCheckpointErrorCode, message: string) {
    super(message);
    this.name = "CampaignCheckpointError";
    this.code = code;
  }
}
