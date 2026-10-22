import type { createRelayAssets } from "../assets/assets";
import type { ObjectConfig } from "../assets/objects";
import type { RelayLimits } from "../limits";
import { createSyncBlobs } from "./blobs";
import { cleanupSync } from "./cleanup";
import { connectRelay } from "./database";
import { createSyncDocuments, type DocumentChange } from "./documents";
import { createPayloadObjects } from "./payloads";

export interface RelaySyncConfig extends ObjectConfig {
  databaseUrl: string;
  assets: ReturnType<typeof createRelayAssets>;
  limits: RelayLimits;
}

/**
 * The blind document store. PostgreSQL keeps metadata, sequence numbers and the latest-state check;
 * object storage keeps every encrypted byte (PRD 0014 R47).
 */
export const createRelaySync = ({ databaseUrl, bucket, s3, assets, limits }: RelaySyncConfig) => {
  const connection = connectRelay(databaseUrl);
  const payloads = createPayloadObjects({ bucket, s3 });
  const listeners = new Set<(change: DocumentChange) => void>();
  const documents = createSyncDocuments({
    connection,
    payloads,
    limits,
    changed: (change) => {
      for (const listener of listeners) listener(change);
    },
  });
  return {
    documents,
    blobs: createSyncBlobs(connection, assets, limits),
    /** Notifies after a commit. Only this relay process's writes are reported. */
    watch(listener: (change: DocumentChange) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cleanup: (now?: Date, signal?: AbortSignal) => cleanupSync({ connection, payloads, assets, limits }, now, signal),
    async close() {
      listeners.clear();
      payloads.close();
      await connection.close();
    },
  };
};
export type RelaySync = ReturnType<typeof createRelaySync>;
