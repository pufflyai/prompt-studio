import type { FolderRecoveryErrorCode } from "pstdio-api-contracts";

/** An actionable restore failure. `path` is relative to the restored folder. */
export class RecoveryRestoreError extends Error {
  constructor(
    readonly code: FolderRecoveryErrorCode,
    message: string,
    readonly path: string | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "RecoveryRestoreError";
  }
}
