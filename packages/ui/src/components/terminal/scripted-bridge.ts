import type { TerminalBridge, TerminalSessionAdapter, TerminalSessionError, TerminalSessionExit } from "./types";

export interface ScriptedTerminalStep {
  /** Bytes the host pushes back to the renderer (utf-8 string is encoded for you). */
  data?: string | Uint8Array;
  /** Milliseconds to wait before delivering this step. */
  delayMs?: number;
  /** Marks the session as exited after this step. */
  exit?: { code: number | null; signal?: string | null };
  /** Delivers a transport error after this step. */
  error?: string;
}

export interface ScriptedBridgeOptions {
  /** Initial script delivered after the first data subscriber attaches. */
  initial?: ScriptedTerminalStep[];
  /**
   * Responds to user input. Return additional steps to play, or `undefined`
   * to ignore. Defaults to echoing the input followed by a newline.
   */
  onInput?: (input: string) => ScriptedTerminalStep[] | undefined;
  /** Called whenever the renderer requests a resize. */
  onResize?: (size: { cols: number; rows: number }) => void;
  /** Called once when the renderer kills the session. */
  onKill?: (signal?: string) => void;
}

const encoder = new TextEncoder();

const toChunk = (data: string | Uint8Array) => (typeof data === "string" ? encoder.encode(data) : data);

const wait = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

const defaultEcho = (input: string): ScriptedTerminalStep[] => [{ data: input.replace(/\r/g, "\r\n") }];

interface SessionEmitter {
  isExited(): boolean;
  emitData(chunk: Uint8Array): void;
  emitExit(exit: TerminalSessionExit): void;
  emitError(error: TerminalSessionError): void;
}

const runStep = (emitter: SessionEmitter, step: ScriptedTerminalStep) => {
  if (step.data !== undefined) emitter.emitData(toChunk(step.data));
  if (step.error !== undefined) emitter.emitError({ message: step.error });
  if (step.exit !== undefined) emitter.emitExit({ code: step.exit.code, signal: step.exit.signal ?? null });
};

const playSteps = async (emitter: SessionEmitter, steps: ScriptedTerminalStep[]) => {
  for (const step of steps) {
    if (emitter.isExited()) return;
    await wait(step.delayMs ?? 0);
    if (emitter.isExited()) return;
    runStep(emitter, step);
  }
};

const createScriptedSession = (
  options: ScriptedBridgeOptions,
  onInput: NonNullable<ScriptedBridgeOptions["onInput"]>,
) => {
  const dataHandlers = new Set<(chunk: Uint8Array) => void>();
  const exitHandlers = new Set<(exit: TerminalSessionExit) => void>();
  const errorHandlers = new Set<(error: TerminalSessionError) => void>();
  let exited = false;
  let startedInitial = false;

  const emitter: SessionEmitter = {
    isExited: () => exited,
    emitData(chunk) {
      for (const handler of dataHandlers) handler(chunk);
    },
    emitExit(exit) {
      if (exited) return;
      exited = true;
      for (const handler of exitHandlers) handler(exit);
    },
    emitError(error) {
      for (const handler of errorHandlers) handler(error);
    },
  };

  const session: TerminalSessionAdapter = {
    id: crypto.randomUUID(),
    write(data) {
      if (exited) return;
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      const response = onInput(text);
      if (response) void playSteps(emitter, response);
    },
    resize(cols, rows) {
      options.onResize?.({ cols, rows });
    },
    kill(signal) {
      if (exited) return;
      options.onKill?.(signal);
      emitter.emitExit({ code: null, signal: signal ?? null });
    },
    onData(handler) {
      dataHandlers.add(handler);
      if (!startedInitial && options.initial) {
        startedInitial = true;
        void playSteps(emitter, options.initial);
      }
      return () => dataHandlers.delete(handler);
    },
    onExit(handler) {
      exitHandlers.add(handler);
      return () => exitHandlers.delete(handler);
    },
    onError(handler) {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
  };

  return { session };
};

/**
 * Deterministic in-memory bridge. Used by stories and tests to exercise the
 * terminal UI without a real PTY supervisor.
 */
export const createScriptedTerminalBridge = (options: ScriptedBridgeOptions = {}): TerminalBridge => {
  const onInput = options.onInput ?? defaultEcho;

  return {
    async openSession(_request) {
      const { session } = createScriptedSession(options, onInput);
      return session;
    },
  };
};
