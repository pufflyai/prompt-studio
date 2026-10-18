import { createClient, parseSyncDeleteEvent as parseSdkSyncDeleteEvent, type SyncWriter } from "@pstdio/sdk/client";
import type { ResourceAnchorChangeEvent, ResourceRemovedEvent } from "@pstdio/sdk/extensions";
import { apiClientOptions } from "@/lib/api";
import { publishExtensionEvent, publishExtensionEventReset } from "@/shared/extensions/extension-webview-broadcast";
import { publishResourceAnchorChange } from "@/shared/extensions/resource-anchor-feed";
import { publishResourceRemoval } from "@/shared/extensions/resource-removal-feed";
import { getRuntimeCollections } from "./collections";

interface SyncCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionLost?: () => void;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_THRESHOLD = 3;

export const parseSyncDeleteEvent = parseSdkSyncDeleteEvent;

export const createDashboardSyncWriterProvider = (collections = getRuntimeCollections()) => {
  const events: Record<string, SyncWriter> = {
    extension_events: {
      truncateAndWrite: () => undefined,
      upsert: (row) => {
        const eventId = typeof row.eventId === "string" ? row.eventId : undefined;
        if (eventId === "pstdio.event.storage-changed") {
          publishExtensionEventReset(collections);
          return;
        }
        const projectId = typeof row.projectId === "string" ? row.projectId : undefined;
        if (eventId) publishExtensionEvent({ id: eventId, projectId }, collections);
      },
      remove: () => undefined,
    },
    resource_anchor_events: {
      truncateAndWrite: () => undefined,
      upsert: (row) => publishResourceAnchorChange(row as unknown as ResourceAnchorChangeEvent, collections),
      remove: () => undefined,
    },
    resource_events: {
      truncateAndWrite: () => undefined,
      upsert: (row) => publishResourceRemoval((row as unknown as ResourceRemovedEvent).resource, collections),
      remove: () => undefined,
    },
  };
  return { getWriter: (table: string) => events[table] ?? collections.getWriter(table) };
};

export const startSync = (apiUrl: string, callbacks: SyncCallbacks = {}, options = apiClientOptions()) => {
  const connection = { ...options, baseUrl: apiUrl };
  const collections = getRuntimeCollections(connection);
  return createClient(connection).sync.start({
    ...createDashboardSyncWriterProvider(collections),
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    heartbeatThreshold: HEARTBEAT_THRESHOLD,
    ...callbacks,
    onConnected: () => {
      publishExtensionEventReset(collections);
      callbacks.onConnected?.();
    },
  });
};
