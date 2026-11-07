export type PublishIndexErrorCode =
  | "INDEX_NOT_FOUND"
  | "INDEX_INVALID"
  | "PACKAGE_NOT_FOUND"
  | "PACKAGE_ARCHIVE_MISSING"
  | "PACKAGE_CONFLICT"
  | "ARCHIVE_INTEGRITY_ERROR"
  | "ARCHIVE_EXISTS_UNINDEXED"
  | "DUPLICATE_ARTIFACT_PATH"
  | "INVALID_PACKAGE_ID";

export class PublishIndexError extends Error {
  readonly code: PublishIndexErrorCode;

  constructor(code: PublishIndexErrorCode, message: string) {
    super(message);
    this.name = "PublishIndexError";
    this.code = code;
  }
}
