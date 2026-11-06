export class WorkspaceFileAccessError extends Error {
  readonly code: "already-exists" | "invalid-target" | "not-found" | "not-file" | "too-large" | "git-metadata";

  constructor(
    message: string,
    code: "already-exists" | "invalid-target" | "not-found" | "not-file" | "too-large" | "git-metadata",
  ) {
    super(message);
    this.name = "WorkspaceFileAccessError";
    this.code = code;
  }
}
