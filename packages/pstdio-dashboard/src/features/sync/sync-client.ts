import { getWriter, type SyncedTable } from "./collections";

interface SyncSetEvent {
  table: SyncedTable;
  data: { id: string; [key: string]: unknown };
  seq: number;
}

interface SyncDeleteEvent {
  table: SyncedTable;
  id: string;
  seq: number;
}

interface InitEvent {
  tables: Record<string, Array<{ id: string; [key: string]: unknown }>>;
  seq: number;
}

export interface SyncClient {
  close: () => void;
  connected: boolean;
}

interface SyncCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const parseSSE = (chunk: string) => {
  let event = "";
  let data = "";
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7);
    else if (line.startsWith("data: ")) data = line.slice(6);
  }
  return { event, data };
};

const handleInit = (data: string, state: SyncClient, callbacks: SyncCallbacks) => {
  const parsed = JSON.parse(data) as InitEvent;
  for (const [table, rows] of Object.entries(parsed.tables)) {
    const writer = getWriter(table as SyncedTable);
    if (writer) writer.truncateAndWrite(rows);
  }
  const wasConnected = state.connected;
  state.connected = true;
  if (!wasConnected) {
    callbacks.onConnected?.();
  }
  return parsed.seq;
};

const handleSyncSet = (data: string) => {
  const parsed = JSON.parse(data) as SyncSetEvent;
  const writer = getWriter(parsed.table);
  if (writer) writer.upsert(parsed.data);
  return parsed.seq;
};

const handleSyncDelete = (data: string) => {
  const parsed = JSON.parse(data) as SyncDeleteEvent;
  const writer = getWriter(parsed.table);
  if (writer) writer.remove(parsed.id);
  return parsed.seq;
};

const readStream = async (body: ReadableStream<Uint8Array>, onMessage: (event: string, data: string) => void) => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop()!;

    for (const part of parts) {
      const { event, data } = parseSSE(part);
      if (event && data) onMessage(event, data);
    }
  }
};

export const startSync = (apiUrl: string, callbacks: SyncCallbacks = {}): SyncClient => {
  let lastSeq = 0;
  let abortController: AbortController | null = null;
  const state: SyncClient = { close: () => {}, connected: false };

  const setDisconnected = () => {
    state.connected = false;
    callbacks.onDisconnected?.();
  };

  const handleEvent = (event: string, data: string) => {
    if (event === "init") lastSeq = handleInit(data, state, callbacks);
    else if (event === "sync:set") lastSeq = Math.max(lastSeq, handleSyncSet(data));
    else if (event === "sync:delete") lastSeq = Math.max(lastSeq, handleSyncDelete(data));
    else if (event === "heartbeat") lastSeq = Math.max(lastSeq, (JSON.parse(data) as { seq: number }).seq);
  };

  const connect = async () => {
    abortController = new AbortController();
    const url = lastSeq > 0 ? `${apiUrl}/v1/sync/stream?since=${lastSeq}` : `${apiUrl}/v1/sync/stream`;

    try {
      const res = await fetch(url, { signal: abortController.signal });
      if (!res.ok || !res.body) throw new Error("SSE connection failed");
      await readStream(res.body, handleEvent);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }

    setDisconnected();
    setTimeout(connect, 1000);
  };

  connect();

  state.close = () => {
    state.connected = false;
    abortController?.abort();
  };

  return state;
};
