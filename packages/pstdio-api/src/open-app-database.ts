import { createDbInWorker } from "pstdio-db";
import type { AppLifecycle } from "./app-contracts";
import { apiLogger } from "./lib/logger";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "./lib/pglite-recovery-hint";
import { logStartupPhase } from "./lib/startup-phase";

const pgliteRecoveryHint = (error: unknown, dbPath: string) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  if (!isPgliteCheckpointFailure(message)) return null;
  return `PGlite failed to open ${dbPath}. ${pgliteRecoverySteps(dbPath)}.`;
};

// The database runs in its own thread (PS-525): PGlite executes and decodes statements synchronously,
// so a long query or a burst of writes there leaves requests, health checks and cancellation free.
export const openAppDatabase = async (
  path: string,
  lifecycle: AppLifecycle = {},
  storageRoot?: string,
  onReleasedUpgrade?: () => void,
) => {
  apiLogger.info({ event: "db.open", thread: "worker" }, "Opening the database");
  try {
    return await createDbInWorker({
      path,
      deferCleanup: true,
      storageRoot,
      onLegacyConversionError: ({ owner, error, backupPath }) =>
        apiLogger.error(
          { err: error, owner, backupPath, event: "storage.legacy_conversion.failed" },
          backupPath
            ? "Legacy storage conversion failed; recovery data was saved"
            : "Legacy storage conversion failed; original data was retained",
        ),
      onPhase: (phase) => {
        logStartupPhase(phase);
        if (phase === "database_released_upgrade") onReleasedUpgrade?.();
        if (phase === "database_locked") lifecycle.onDatabaseLockAcquired?.();
      },
      // A worker that dies leaves the database unusable and its lock released, so the runtime must stop:
      // an uncaught error takes the same fatal shutdown path as any other.
      onUnexpectedExit: (error) =>
        setTimeout(() => {
          throw error;
        }),
    });
  } catch (err) {
    const hint = pgliteRecoveryHint(err, path);
    apiLogger.error({ dataDir: path, err, event: "db.open.failed", hint }, hint ?? "PGlite database failed to open");
    if (!hint) throw err;
    throw new Error(hint, { cause: err });
  }
};
