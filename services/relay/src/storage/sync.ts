import type { createRelayAssets } from "../assets/assets";
import type { ObjectConfig } from "../assets/objects";
import type { RelayLimits } from "../limits";
import { createSyncBlobs } from "./blobs";
import { cleanupSync } from "./cleanup";
import { connectRelay } from "./database";
import { createSyncDocuments, type DocumentChange } from "./documents";
import { createPayloadObjects } from "./payloads";
import { createProjectAccess } from "./project-access";
import { createProjectDeletion } from "./project-deletion";
import { createProjectNotices } from "./project-notices";

export interface RelaySyncConfig extends ObjectConfig {
  databaseUrl: string;
  assets: ReturnType<typeof createRelayAssets>;
  limits: RelayLimits;
  poolMax?: number;
}

/**
 * The blind document store. PostgreSQL keeps metadata, sequence numbers and the latest-state check;
 * object storage keeps every encrypted byte (PRD 0014 R47).
 */
export const createRelaySync = ({ databaseUrl, bucket, s3, assets, limits, poolMax }: RelaySyncConfig) => {
  const connection = connectRelay(databaseUrl, poolMax);
  const control = connectRelay(databaseUrl, poolMax);
  const projectAccess = createProjectAccess(control);
  const retired = new Set<(key: string) => void>();
  const disconnected = new Set<() => void>();
  const projectNotices = createProjectNotices(
    databaseUrl,
    (key) => {
      for (const listener of retired) listener(key);
    },
    () => {
      for (const listener of disconnected) listener();
    },
  );
  const payloads = createPayloadObjects({ bucket, s3 });
  const listeners = new Set<(change: DocumentChange) => void>();
  const documents = createSyncDocuments({
    connection,
    payloads,
    access: projectAccess,
    limits,
    changed: (change) => {
      for (const listener of listeners) listener(change);
    },
  });
  return {
    documents,
    projectAccess,
    projectNotices,
    deleteProject: createProjectDeletion({ connection, control, payloads, assets }),
    watchRetirement(onRetired: (key: string) => void, onDisconnected: () => void) {
      retired.add(onRetired);
      disconnected.add(onDisconnected);
    },
    blobs: createSyncBlobs(connection, assets, limits, projectAccess),
    /** Notifies after a commit. Only this relay process's writes are reported. */
    watch(listener: (change: DocumentChange) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cleanup: (now?: Date, signal?: AbortSignal) => cleanupSync({ connection, payloads, assets, limits }, now, signal),
    async close() {
      listeners.clear();
      await projectNotices.close();
      payloads.close();
      await Promise.all([connection.close(), control.close()]);
    },
  };
};
export type RelaySync = ReturnType<typeof createRelaySync>;
