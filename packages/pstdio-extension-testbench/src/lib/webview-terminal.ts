import type {
  TerminalEvent,
  TerminalSessionBridgeRequest,
  TerminalSessionBridgeResult,
  TerminalSessionOpenRequest,
} from "@pstdio/sdk/extensions";
import type { ExtensionWebviewTerminalCapability } from "pstdio-workbench/extensions";

/**
 * Scripted, in-memory terminal host used by the testbench preview (and any
 * storybook-style harness) instead of spawning a real shell. It speaks the
 * same `terminal.session` bridge shape the production host uses, so any
 * webview that works against the deterministic host will also work against
 * Bun's PTY supervisor without code changes.
 *
 * Input bytes are echoed back as the next `data` event; calling `kill` (or
 * supplying a script that emits `exit`) cleanly closes the next-event queue.
 */

type TerminalScript = (input: {
  request: TerminalSessionOpenRequest["request"];
  sessionId: string;
}) => Iterable<TerminalEvent> | AsyncIterable<TerminalEvent>;

export interface CreatePreviewWebviewTerminalHostInput {
  /**
   * Optional scripted output. Defaults to echoing each `write` payload back as
   * a `data` event and emitting `{ kind: "exit", code: 0, signal: null }` on
   * `kill`.
   */
  script?: TerminalScript;
}

interface SessionState {
  buffer: TerminalEvent[];
  closed: boolean;
  wake: (() => void) | null;
}

const toBytes = (data: string | Uint8Array) =>
  typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);

export const createPreviewWebviewTerminalHost = (
  input: CreatePreviewWebviewTerminalHostInput = {},
): ExtensionWebviewTerminalCapability => {
  const sessions = new Map<string, SessionState>();

  const notify = (state: SessionState) => {
    const resume = state.wake;
    state.wake = null;
    resume?.();
  };

  const push = (sessionId: string, event: TerminalEvent) => {
    const state = sessions.get(sessionId);
    if (!state || state.closed) return;
    state.buffer.push(event);
    if (event.kind === "exit") state.closed = true;
    notify(state);
  };

  const consumeScript = async (sessionId: string, script: ReturnType<TerminalScript>) => {
    for await (const event of script) {
      push(sessionId, event);
      if (event.kind === "exit") return;
    }
  };

  const open = (request: TerminalSessionOpenRequest["request"]): TerminalSessionBridgeResult => {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { buffer: [], closed: false, wake: null });

    if (input.script) {
      void consumeScript(sessionId, input.script({ request, sessionId }));
    }

    return { op: "open", sessionId };
  };

  const nextEvent = async (sessionId: string): Promise<TerminalSessionBridgeResult> => {
    const state = sessions.get(sessionId);
    if (!state) return { op: "event", event: null };

    while (state.buffer.length === 0) {
      if (state.closed) {
        sessions.delete(sessionId);
        return { op: "event", event: null };
      }
      await new Promise<void>((resolve) => {
        state.wake = resolve;
      });
    }

    const event = state.buffer.shift()!;
    if (event.kind === "exit") sessions.delete(sessionId);
    return { op: "event", event };
  };

  return {
    async session(request: TerminalSessionBridgeRequest): Promise<TerminalSessionBridgeResult> {
      if (request.op === "open") return open(request.request);

      if (request.op === "write") {
        // Echo input back as a data event so deterministic tests can assert
        // round-trip flow without a real shell.
        if (!input.script) push(request.sessionId, { kind: "data", chunk: toBytes(request.data) });
        return { op: "ack" };
      }

      if (request.op === "resize") return { op: "ack" };

      if (request.op === "kill") {
        if (!input.script) push(request.sessionId, { kind: "exit", code: 0, signal: null });
        return { op: "ack" };
      }

      return nextEvent(request.sessionId);
    },
  };
};
