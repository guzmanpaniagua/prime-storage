export type ProjectStateErrorCode = "PHASES_INVALID";

export class ProjectStateError extends Error {
  readonly code: ProjectStateErrorCode;

  constructor(code: ProjectStateErrorCode, message: string) {
    super(message);
    this.name = "ProjectStateError";
    this.code = code;
  }
}
