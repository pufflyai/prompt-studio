import { type ClientOptions, createRequestHeaders, resolveBaseUrl, resolveClientUrl, resolveFetch } from "./request";
import { readSseStream } from "./sse";

export type SyncRow = { id: string; [key: string]: unknown };

export type SyncWriter = {
  truncateAndWrite: (rows: SyncRow[]) => void;
  upsert: (row: SyncRow) => void;
  remove: (id: string) => void;
};

export type SyncWriterProvider = {
  getWriter: (table: string) => SyncWriter | undefined;
};

export type SyncConnection = {
  close: () => void;
  connected: boolean;
};

export type StartSyncInput = SyncWriterProvider & {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionLost?: () => void;
  heartbeatIntervalMs?: number;
  heartbeatThreshold?: number;
  reconnectDelayMs?: number;
};

export type SyncClient = {
  start: (input: StartSyncInput) => SyncConnection;
};

type SyncSetEvent = {
  table: string;
  data: SyncRow;
  seq: number;
};

type RawSyncDeleteEvent = {
  table: string;
  id?: string;
  data?: { id?: string };
  seq: number;
};

type InitEvent = {
  tables: Record<string, SyncRow[]>;
  seq: number;
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;
const DEFAULT_HEARTBEAT_THRESHOLD = 3;
const DEFAULT_RECONNECT_DELAY_MS = 1000;

export const parseSyncDeleteEvent = (data: string) => {
  const parsed = JSON.parse(data) as RawSyncDeleteEvent;
  const id = parsed.id ?? parsed.data?.id;

  if (!id) {
    throw new Error("Missing id in sync:delete event.");
  }

  return {
    table: parsed.table,
    id,
    seq: parsed.seq,
  };
};

export const applySyncEvent = (event: string, data: string, writers: SyncWriterProvider) => {
  if (event === "init") {
    const parsed = JSON.parse(data) as InitEvent;
    for (const [table, rows] of Object.entries(parsed.tables)) {
      writers.getWriter(table)?.truncateAndWrite(rows);
    }
    return parsed.seq;
  }

  if (event === "sync:set") {
    const parsed = JSON.parse(data) as SyncSetEvent;
    writers.getWriter(parsed.table)?.upsert(parsed.data);
    return parsed.seq;
  }

  if (event === "sync:delete") {
    const parsed = parseSyncDeleteEvent(data);
    writers.getWriter(parsed.table)?.remove(parsed.id);
    return parsed.seq;
  }

  if (event === "heartbeat") {
    return (JSON.parse(data) as { seq: number }).seq;
  }

  return null;
};

const createHeartbeatMonitor = (input: { intervalMs: number; threshold: number; onConnectionLost?: () => void }) => {
  let missedHeartbeats = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    recordHeartbeat: () => {
      missedHeartbeats = 0;
    },
    start: () => {
      timer = setInterval(() => {
        missedHeartbeats += 1;
        if (missedHeartbeats >= input.threshold) {
          input.onConnectionLost?.();
        }
      }, input.intervalMs);
    },
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
};

const buildSyncStreamPath = (lastSeq: number) => (lastSeq > 0 ? `/v1/sync/stream?since=${lastSeq}` : "/v1/sync/stream");

export const createSyncClient = (clientOptions: ClientOptions): SyncClient => ({
  start: (input) => {
    let lastSeq = 0;
    let abortController: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const state: SyncConnection = { close: () => {}, connected: false };

    const heartbeatMonitor = createHeartbeatMonitor({
      intervalMs: input.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      threshold: input.heartbeatThreshold ?? DEFAULT_HEARTBEAT_THRESHOLD,
      onConnectionLost: input.onConnectionLost,
    });

    const setConnected = () => {
      const wasConnected = state.connected;
      state.connected = true;
      if (!wasConnected) input.onConnected?.();
    };

    const setDisconnected = () => {
      const wasConnected = state.connected;
      state.connected = false;
      if (wasConnected) input.onDisconnected?.();
    };

    const handleEvent = (event: string, data: string) => {
      heartbeatMonitor.recordHeartbeat();
      const nextSeq = applySyncEvent(event, data, input);
      if (nextSeq !== null) lastSeq = Math.max(lastSeq, nextSeq);
      if (event === "init") setConnected();
    };

    const connect = async () => {
      if (closed) return;

      abortController = new AbortController();
      try {
        const response = await resolveFetch(clientOptions)(
          resolveClientUrl(resolveBaseUrl(clientOptions), buildSyncStreamPath(lastSeq)),
          {
            headers: Object.fromEntries(createRequestHeaders(clientOptions).entries()),
            signal: abortController.signal,
            credentials: "same-origin",
          },
        );
        if (!response.ok || !response.body) throw new Error("SSE connection failed");
        await readSseStream(response.body, ({ event, data }) => handleEvent(event, data), {
          signal: abortController.signal,
        });
      } catch (err) {
        if (closed || (err as Error).name === "AbortError") return;
      }

      if (closed) return;
      setDisconnected();
      reconnectTimer = setTimeout(connect, input.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS);
    };

    heartbeatMonitor.start();
    void connect();

    state.close = () => {
      closed = true;
      state.connected = false;
      heartbeatMonitor.stop();
      abortController?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    return state;
  },
});
