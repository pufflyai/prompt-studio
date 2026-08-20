import {
  createClient,
  parseSyncDeleteEvent as parseSdkSyncDeleteEvent,
  type SyncConnection,
  type SyncRow,
  type SyncWriter,
  type SyncWriterProvider,
} from "@pstdio/sdk/client";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
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

const extensionEventWriter: SyncWriter = {
  truncateAndWrite: () => undefined,
  upsert: (row: SyncRow) => {
    const eventId = typeof row.eventId === "string" ? row.eventId : undefined;
    const projectId = typeof row.projectId === "string" ? row.projectId : undefined;
    if (eventId) publishExtensionEvent({ id: eventId, projectId });
  },
  remove: () => undefined,
};

export const createDashboardSyncWriterProvider = (): SyncWriterProvider => ({
  getWriter: (table) => (table === "extension_events" ? extensionEventWriter : getWriter(table as SyncedTable)),
});

export const startSync = (apiUrl: string, callbacks: SyncCallbacks = {}): SyncClient =>
  createClient({ baseUrl: apiUrl }).sync.start({
    ...createDashboardSyncWriterProvider(),
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    heartbeatThreshold: HEARTBEAT_THRESHOLD,
    ...callbacks,
  });
