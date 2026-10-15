import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import type { SessionStreamConnection, SessionStreamHandlers } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { RendererReadBinding, RendererReadRegistry } from "@pstdio/workbench";
import type { SyncedRow } from "@/lib/sync/collections";
import { getSessionHistoryCache, isSessionLive, sessionHistoryVersion } from "./session-history-cache";
import {
  applyDashboardSessionMessagePatch,
  type DashboardSessionMessagePatch,
  visibleSessionMessages,
} from "./session-messages";
import { type SessionNotice, toSessionNotice } from "./session-notice";

export interface SessionHistoryState {
  messages: SessionMessage[];
  queue?: PendingQueuedFollowUpsResponse;
  loading: boolean;
  streaming: boolean;
  error?: SessionNotice;
  queueError?: SessionNotice;
}
interface HistoryTransport {
  getConversation(id: string, signal?: AbortSignal): Promise<{ messages: SessionMessage[] }>;
  getQueuedMessages(
    id: string,
    options?: { signal?: AbortSignal },
  ): Promise<{ messages: SessionMessage[]; queue?: PendingQueuedFollowUpsResponse }>;
  connectStream(id: string, handlers: SessionStreamHandlers): SessionStreamConnection;
}
interface HistoryControllerInput {
  sessionId: string;
  ownerKey: string;
  reads: RendererReadRegistry;
  transport: HistoryTransport;
  onChange(state: SessionHistoryState): void;
  initialState?: SessionHistoryState;
  initialSession?: SyncedRow;
}

export const createSessionHistoryController = (input: HistoryControllerInput) => {
  const { sessionId, ownerKey, reads, transport, onChange } = input;
  const cache = getSessionHistoryCache(transport);
  const releaseCache = cache.retain(sessionId);
  let session = input.initialSession;
  const isQueued = (message: SessionMessage) => message.id.startsWith(`queued-prompt-${sessionId}-`);
  let confirmed = input.initialState?.messages.filter((message) => !isQueued(message)) ?? [];
  let queued = input.initialState?.messages.filter(isQueued) ?? [];
  let state: SessionHistoryState = input.initialState ?? { messages: [], loading: true, streaming: false };
  let generation = 0;
  let revision = 0;
  let queueRevision = 0;
  // Counts queue snapshots shown, so a read can tell whether a snapshot arrived after it started.
  let queueSnapshots = 0;
  let snapshotSeen = false;
  let disposed = false;
  let connection: SessionStreamConnection | undefined;
  let historyBinding: RendererReadBinding | undefined;
  let queueBinding: RendererReadBinding | undefined;
  const publish = (next: Partial<SessionHistoryState> = {}) => {
    state = { ...state, ...next, messages: [...visibleSessionMessages(confirmed), ...queued] };
    if (!disposed) onChange(state);
  };
  const showQueue = (value: { messages: SessionMessage[]; queue?: PendingQueuedFollowUpsResponse }) => {
    queued = value.messages;
    queueSnapshots++;
    publish({ queueError: undefined, queue: value.queue });
  };
  // Resolves with the queue shown once this read settles, when a snapshot arrived after it started.
  const refreshQueue = async (reason: "refresh" | "retry" = "refresh") => {
    if (disposed) return undefined;
    const current = generation;
    const startedRevision = queueRevision;
    const startedSnapshots = queueSnapshots;
    queueBinding ??= reads.bind(`${ownerKey}:queue`);
    await queueBinding.request(
      {
        queryKey: JSON.stringify([current, startedRevision]),
        load: (signal) => transport.getQueuedMessages(sessionId, { signal }),
        onValue: (value) => {
          if (current !== generation || startedRevision !== queueRevision) return;
          showQueue(value);
        },
        onError: (error) => publish({ queueError: toSessionNotice(error) }),
      },
      reason,
    );
    return queueSnapshots === startedSnapshots ? undefined : state.queue;
  };
  const readHistory = () => {
    if (disposed) return;
    const cached = cache.get(sessionId, session);
    if (cached) {
      confirmed = cached;
      publish({ loading: false, error: undefined });
      return;
    }
    const current = generation;
    const startedRevision = revision;
    const sessionAtRead = session;
    const version = sessionHistoryVersion(sessionAtRead);
    historyBinding ??= reads.bind(`${ownerKey}:transcript`);
    historyBinding.request(
      {
        queryKey: JSON.stringify([current, startedRevision, version]),
        load: (signal) => transport.getConversation(sessionId, signal),
        onValue: (value) => {
          if (current !== generation || startedRevision !== revision || version !== sessionHistoryVersion(session))
            return;
          confirmed = value.messages.filter((message) => !isQueued(message));
          cache.set(sessionId, sessionAtRead, confirmed);
          publish({ loading: false, error: undefined });
        },
        onError: (error) => publish({ loading: false, error: toSessionNotice(error) }),
      },
      "refresh",
    );
  };
  const connect = () => {
    if (disposed) return;
    const current = ++generation;
    connection?.close();
    historyBinding?.dispose();
    historyBinding = undefined;
    queueBinding?.dispose();
    queueBinding = reads.bind(`${ownerKey}:queue`);
    snapshotSeen = false;
    publish({ loading: confirmed.length === 0, streaming: false, error: undefined });
    void refreshQueue();
    if (!isSessionLive(session)) {
      connection = undefined;
      readHistory();
      return;
    }
    const active = () => !disposed && generation === current;
    connection = transport.connectStream(sessionId, {
      onReady: () => {
        if (active()) publish({ streaming: true });
      },
      onPatch: (data) => {
        if (!active()) return;
        const patch = data as DashboardSessionMessagePatch;
        const previous = confirmed;
        confirmed = applyDashboardSessionMessagePatch(confirmed, patch);
        if (confirmed === previous) return;
        revision++;
        if (patch.path === "/messages") snapshotSeen = true;
        publish({ loading: false, streaming: true, error: undefined });
      },
      onQueuedMessages: (value) => {
        if (!active()) return;
        queueRevision++;
        queueBinding?.dispose();
        queueBinding = undefined;
        if ("error" in value) publish({ queueError: { message: value.error, temporary: true } });
        else showQueue(value);
      },
      onEnd: () => {
        if (!active()) return;
        publish({ loading: false, streaming: false });
        connection?.close();
        connection = undefined;
        if (snapshotSeen) cache.set(sessionId, session, confirmed);
        else readHistory();
        void refreshQueue("retry");
      },
      onError: (error) => {
        if (!active()) return;
        snapshotSeen = false;
        connection?.close();
        connection = undefined;
        publish({ loading: false, streaming: false, error: toSessionNotice(error) });
      },
    });
  };
  return {
    connect,
    reconnect() {
      cache.invalidate(sessionId);
      connect();
    },
    refreshQueue: () => refreshQueue("retry"),
    sessionChanged(row: SyncedRow | undefined) {
      if (row && row.id !== sessionId) return;
      const previous = session;
      session = row;
      if (
        isSessionLive(row) &&
        (!isSessionLive(previous) || row?.last_request_started !== previous?.last_request_started)
      ) {
        connect();
        return;
      }
      // A live stream publishes queue changes itself; after it ends, the row event is the signal.
      if (!connection) {
        if (isSessionLive(row)) {
          void refreshQueue();
          return;
        }
        if (snapshotSeen && row?.last_request_started === previous?.last_request_started)
          cache.set(sessionId, row, confirmed);
        else if (sessionHistoryVersion(row) !== sessionHistoryVersion(previous)) readHistory();
        void refreshQueue();
      }
    },
    dispose() {
      disposed = true;
      generation++;
      connection?.close();
      historyBinding?.dispose();
      queueBinding?.dispose();
      releaseCache();
    },
  };
};
