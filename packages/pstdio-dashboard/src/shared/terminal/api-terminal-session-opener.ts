import type { WorkbenchTerminalSessionExit, WorkbenchTerminalSessionOpener } from "pstdio-workbench/core";
import { buildApiUrl } from "@/lib/api";
import { createTerminalSseParser, type TerminalStreamEvent } from "./terminal-sse";

const encodeBase64 = (data: string | Uint8Array) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

// Output can arrive before the consumer attaches handlers (the capability
// subscribes in a follow-up operation) — buffer until the first one does.
const createSessionEventHub = () => {
  const dataHandlers = new Set<(chunk: Uint8Array) => void>();
  const exitHandlers = new Set<(exit: WorkbenchTerminalSessionExit) => void>();
  const errorHandlers = new Set<(error: { message: string }) => void>();
  const pendingData: Uint8Array[] = [];
  let pendingExit: WorkbenchTerminalSessionExit | null = null;

  const dispatch = (event: TerminalStreamEvent) => {
    if (event.kind === "data") {
      if (dataHandlers.size === 0) {
        pendingData.push(event.chunk);
        return;
      }
      for (const handler of dataHandlers) handler(event.chunk);
      return;
    }
    if (event.kind === "exit") {
      const exit = { code: event.code, signal: event.signal };
      if (exitHandlers.size === 0) pendingExit = exit;
      for (const handler of exitHandlers) handler(exit);
      return;
    }
    for (const handler of errorHandlers) handler({ message: event.message });
  };

  return {
    dispatch,
    emitError: (message: string) => dispatch({ kind: "error", message }),
    onData(handler: (chunk: Uint8Array) => void) {
      dataHandlers.add(handler);
      while (pendingData.length > 0) handler(pendingData.shift() as Uint8Array);
      return () => dataHandlers.delete(handler);
    },
    onExit(handler: (exit: WorkbenchTerminalSessionExit) => void) {
      exitHandlers.add(handler);
      if (pendingExit) {
        handler(pendingExit);
        pendingExit = null;
      }
      return () => exitHandlers.delete(handler);
    },
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
    onExit: hub.onExit,
    onError: hub.onError,
  };
};
