import { createClient, parseSyncDeleteEvent as parseSdkSyncDeleteEvent, type SyncConnection } from "@pstdio/sdk/client";
import { getWriter, type SyncedTable } from "./collections";

export type SyncClient = SyncConnection;

interface SyncCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionLost?: () => void;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_THRESHOLD = 3;

export const parseSyncDeleteEvent = parseSdkSyncDeleteEvent;

export const startSync = (apiUrl: string, callbacks: SyncCallbacks = {}): SyncClient =>
  createClient({ baseUrl: apiUrl }).sync.start({
    getWriter: (table) => getWriter(table as SyncedTable),
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    heartbeatThreshold: HEARTBEAT_THRESHOLD,
    ...callbacks,
  });
