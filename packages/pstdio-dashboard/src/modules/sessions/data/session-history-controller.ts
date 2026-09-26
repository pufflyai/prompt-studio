import type { SessionHistoryIssue } from "@pstdio/sdk/api";
import type { SessionStreamConnection, SessionStreamHandlers } from "@pstdio/sdk/client";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { RendererReadBinding, RendererReadRegistry } from "@pstdio/workbench";
import type { SyncedRow } from "@/lib/sync/collections";
import {
  applyDashboardSessionMessagePatch,
  type DashboardSessionMessagePatch,
  visibleSessionMessages,
} from "./session-messages";

export interface SessionHistoryState {
  messages: SessionMessage[];
  loading: boolean;
  streaming: boolean;
  historyIssue?: SessionHistoryIssue;
  error?: string;
  queueError?: string;
}
interface HistoryTransport {
  getConversation(
    id: string,
    signal?: AbortSignal,
  ): Promise<{ messages: SessionMessage[]; historyIssue?: SessionHistoryIssue }>;
  getQueuedMessages(id: string, options?: { signal?: AbortSignal }): Promise<{ messages: SessionMessage[] }>;
  connectStream(id: string, handlers: SessionStreamHandlers, options?: { attempt?: number }): SessionStreamConnection;
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
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
export const createSessionHistoryController = (input: HistoryControllerInput) => {
  const { sessionId, ownerKey, reads, transport, onChange } = input;
  const isQueued = (message: SessionMessage) => message.id.startsWith(`queued-prompt-${sessionId}-`);
  let confirmed = input.initialState?.messages.filter((message) => !isQueued(message)) ?? [];
  let queued = input.initialState?.messages.filter(isQueued) ?? [];
  let state: SessionHistoryState = input.initialState ?? { messages: [], loading: true, streaming: false };
  let generation = 0;
  let revision = 0;
  let queueRevision = 0;
  let snapshotSeen = false;
  let ended = false;
  let disposed = false;
  let runStartedAt = input.initialSession?.last_request_started;
  let connection: SessionStreamConnection | undefined;
  let historyBinding: RendererReadBinding | undefined;
  let queueBinding: RendererReadBinding | undefined;
  const publish = (next: Partial<SessionHistoryState> = {}) => {
    state = { ...state, ...next, messages: [...visibleSessionMessages(confirmed), ...queued] };
    if (!disposed) onChange(state);
  };
  const refreshQueue = (reason: "refresh" | "retry" = "refresh") => {
    if (disposed) return;
    const current = generation;
    const startedRevision = queueRevision;
    queueBinding ??= reads.bind(`${ownerKey}:queue`);
    queueBinding.request(
      {
        queryKey: JSON.stringify([current, startedRevision]),
        load: (signal) => transport.getQueuedMessages(sessionId, { signal }),
        onValue: (value) => {
          if (current !== generation || startedRevision !== queueRevision) return;
          queued = value.messages;
          publish({ queueError: undefined });
        },
        onError: (error) => publish({ queueError: errorText(error) }),
      },
      reason,
    );
  };
  const readHistory = (reason: "refresh" | "retry" = "refresh") => {
    if (disposed) return;
    const current = generation;
    const startedRevision = revision;
    historyBinding ??= reads.bind(`${ownerKey}:transcript`);
    historyBinding.request(
      {
        queryKey: JSON.stringify([current, startedRevision]),
        load: (signal) => transport.getConversation(sessionId, signal),
        onValue: (value) => {
          if (current !== generation || startedRevision !== revision) return;
          confirmed = value.messages.filter((message) => !isQueued(message));
          publish({ loading: false, error: undefined, historyIssue: value.historyIssue });
        },
        onError: (error) => publish({ loading: false, error: errorText(error) }),
      },
      reason,
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
    ended = false;
    snapshotSeen = false;
    publish({ loading: true, streaming: false, error: undefined });
    readHistory();
    refreshQueue();
    const active = () => !disposed && generation === current;
    connection = transport.connectStream(
      sessionId,
      {
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
          if (!snapshotSeen && patch.path === "/messages") {
            snapshotSeen = true;
            historyBinding?.dispose();
            historyBinding = undefined;
          }
          publish({
            loading: false,
            streaming: true,
            error: undefined,
            ...(patch.path === "/messages" ? { historyIssue: undefined } : {}),
          });
        },
        onQueuedMessages: (value) => {
          if (!active()) return;
          queueRevision++;
          queueBinding?.dispose();
          queueBinding = undefined;
          if ("error" in value) publish({ queueError: value.error });
          else {
            queued = value.messages;
            publish({ queueError: undefined });
          }
        },
        onHistoryIssue: (historyIssue) => {
          if (active()) publish({ historyIssue });
        },
        onEnd: () => {
          if (!active()) return;
          ended = true;
          publish({ loading: false, streaming: false });
          connection?.close();
          readHistory();
          refreshQueue("retry");
        },
        onError: (error) => {
          if (!active()) return;
          ended = true;
          publish({ loading: false, streaming: false, error: errorText(error) });
        },
      },
      { attempt: current },
    );
  };
  return {
    connect,
    refreshQueue: () => refreshQueue("retry"),
    retryHistory: () => (ended ? connect() : readHistory("retry")),
    sessionChanged(row: SyncedRow | undefined) {
      if (row && row.id !== sessionId) return;
      const active = row?.status === "in_progress" || row?.status === "awaiting_input";
      if (active && row?.last_request_started !== runStartedAt) {
        runStartedAt = row?.last_request_started;
        connect();
        return;
      }
      refreshQueue();
    },
    dispose() {
      disposed = true;
      generation++;
      connection?.close();
      historyBinding?.dispose();
      queueBinding?.dispose();
    },
  };
};
