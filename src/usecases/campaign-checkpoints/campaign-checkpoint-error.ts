export type CampaignCheckpointErrorCode =
  | "CHECKPOINT_INVALID"
  | "CHECKPOINT_SEQUENCE_CONFLICT"
  | "CHECKPOINT_POINTER_CONFLICT"
  | "CHECKPOINT_ARTIFACT_CONFLICT"
  | "CHECKPOINT_ARCHIVE_NOT_FOUND"
  | "CHECKPOINT_ARCHIVE_INVALID"
  | "CHECKPOINT_ARCHIVE_HASH_MISMATCH"
  | "CHECKPOINT_HASH_MISMATCH";

export class CampaignCheckpointError extends Error {
  readonly code: CampaignCheckpointErrorCode;

  constructor(code: CampaignCheckpointErrorCode, message: string) {
    super(message);
    this.name = "CampaignCheckpointError";
    this.code = code;
  }
}
