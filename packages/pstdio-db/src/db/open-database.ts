import type { DbOpenPhase } from "./connection.pglite";
import type { LegacyConversionFailure } from "./legacy-record-upgrade";
import { canonicalDbPath, resolveDbPath } from "./paths";
import { acquirePgliteLock } from "./pglite-lock";

export interface DbOpenOptions {
  path?: string;
  onPhase?: (phase: DbOpenPhase) => void;
  signal?: AbortSignal;
  /** Folder for encrypted index nodes; defaults to a sibling of the database folder. */
  indexNodesPath?: string;
  storageRoot?: string;
  onLegacyConversionError?: (failure: LegacyConversionFailure) => void;
  /** The runtime vacuums in the background and schedules deletion of retired rows. */
  deferCleanup?: boolean;
}

export const createDb = async (options?: DbOpenOptions) => {
  const path = canonicalDbPath(resolveDbPath(options?.path));
  const release = path === ":memory:" ? () => {} : acquirePgliteLock(path);
  try {
    options?.onPhase?.("database_locked");
    options?.signal?.throwIfAborted();
    const { openLockedDatabase } = await import("./connection.pglite");
    return await openLockedDatabase(path, release, options);
  } catch (error) {
    release();
    throw error;
  }
};
