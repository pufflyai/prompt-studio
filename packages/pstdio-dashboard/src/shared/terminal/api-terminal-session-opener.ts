import type { WorkbenchTerminalSessionExit, WorkbenchTerminalSessionOpener } from "@pstdio/workbench/core";
import { buildApiUrl } from "@/lib/api";
import { createTerminalSseParser, type TerminalStreamEvent } from "./terminal-sse";

const encodeBase64 = (data: string | Uint8Array) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

// A subscribable channel that buffers events emitted before a handler attaches
// (the consumer subscribes in a follow-up step). "queue" replays every buffered
// value in order (output); "latest" replays only the most recent (title/exit).
const createChannel = <T>(replay: "queue" | "latest") => {
  const handlers = new Set<(value: T) => void>();
  const pending: T[] = [];

  return {
    emit(value: T) {
      if (handlers.size === 0) {
        if (replay === "queue") pending.push(value);
        else pending[0] = value;
        return;
      }
      for (const handler of handlers) handler(value);
    },
    subscribe(handler: (value: T) => void) {
      handlers.add(handler);
      while (pending.length > 0) handler(pending.shift() as T);
      return () => handlers.delete(handler);
    },
  };
};

// Fans a session's SSE stream out to renderer-side handlers, buffering events
// that arrive before the consumer subscribes.
const createSessionEventHub = () => {
  const data = createChannel<Uint8Array>("queue");
  const title = createChannel<string>("latest");
  const exit = createChannel<WorkbenchTerminalSessionExit>("latest");
  const errorHandlers = new Set<(error: { message: string }) => void>();

  const dispatch = (event: TerminalStreamEvent) => {
    if (event.kind === "data") return data.emit(event.chunk);
    if (event.kind === "title") return title.emit(event.title);
    if (event.kind === "exit") return exit.emit({ code: event.code, signal: event.signal });
    for (const handler of errorHandlers) handler({ message: event.message });
  };

  return {
    dispatch,
    emitError: (message: string) => dispatch({ kind: "error", message }),
    onData: data.subscribe,
    onTitle: title.subscribe,
    onExit: exit.subscribe,
    onError(handler: (error: { message: string }) => void) {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
  };
};

const pumpSessionEvents = async (
  eventsUrl: string,
  signal: AbortSignal,
  dispatch: (event: TerminalStreamEvent) => void,
) => {
  const response = await fetch(eventsUrl, { signal });
  if (!response.ok || !response.body) throw new Error(`Terminal event stream failed (${response.status}).`);

  const parser = createTerminalSseParser();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    if (signal.aborted) return;
    const { done, value } = await reader.read();
    if (done) return;
    for (const event of parser.push(decoder.decode(value, { stream: true }))) dispatch(event);
  }
};

/**
 * Workbench terminal session opener backed by the API PTY transport:
 * `POST /v1/terminal/sessions` opens the PTY, the SSE `events` endpoint streams
 * output/exit, and stdin/geometry/kill go to the session's REST endpoints.
 */
export const openDashboardTerminalSession: WorkbenchTerminalSessionOpener = async (request) => {
  const response = await fetch(buildApiUrl("/v1/terminal/sessions"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Could not open a terminal session (${response.status}).`);
  const { sessionId } = (await response.json()) as { sessionId: string };

  const sessionUrl = (suffix = "") => buildApiUrl(`/v1/terminal/sessions/${sessionId}${suffix}`);
  const hub = createSessionEventHub();
  const eventsAbort = new AbortController();

  void pumpSessionEvents(sessionUrl("/events"), eventsAbort.signal, hub.dispatch).catch((error) => {
    if (eventsAbort.signal.aborted) return;
    hub.emitError(error instanceof Error ? error.message : String(error));
  });

  // Stdin arrives one keystroke per call; parallel POSTs can complete out of
  // order and scramble the bytes the shell sees, so all operations share one
  // serial queue.
  let operationQueue: Promise<unknown> = Promise.resolve();
  const post = (suffix: string, body: unknown) => {
    operationQueue = operationQueue
      .then(() =>
        fetch(sessionUrl(suffix), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      )
      .catch((error) => hub.emitError(error instanceof Error ? error.message : String(error)));
  };

  return {
    id: sessionId,
    write(data) {
      post("/write", { data: encodeBase64(data) });
    },
    resize(cols, rows) {
      post("/resize", { cols, rows });
    },
    async kill() {
      eventsAbort.abort();
      await fetch(sessionUrl(), { method: "DELETE" });
    },
    onData: hub.onData,
    onTitle: hub.onTitle,
    onExit: hub.onExit,
    onError: hub.onError,
  };
};
