import { describe, expect, test } from "bun:test";
import { bindSessionToSink, type TerminalSink } from "./bind-session";
import type { TerminalSessionAdapter, TerminalSessionError, TerminalSessionExit } from "./types";

interface FakeSink extends TerminalSink {
  writes: Array<string | Uint8Array>;
  emitInput(data: string): void;
  emitResize(size: { cols: number; rows: number }): void;
  inputHandlers: Set<(data: string) => void>;
  resizeHandlers: Set<(size: { cols: number; rows: number }) => void>;
}

const createFakeSink = (): FakeSink => {
  const writes: Array<string | Uint8Array> = [];
  const inputHandlers = new Set<(data: string) => void>();
  const resizeHandlers = new Set<(size: { cols: number; rows: number }) => void>();
  return {
    writes,
    inputHandlers,
    resizeHandlers,
    write(data) {
      writes.push(data);
    },
    onInput(handler) {
      inputHandlers.add(handler);
      return () => inputHandlers.delete(handler);
    },
    onResize(handler) {
      resizeHandlers.add(handler);
      return () => resizeHandlers.delete(handler);
    },
    emitInput(data) {
      for (const handler of inputHandlers) handler(data);
    },
    emitResize(size) {
      for (const handler of resizeHandlers) handler(size);
    },
  };
};

interface FakeSession extends TerminalSessionAdapter {
  emitData(chunk: Uint8Array): void;
  emitExit(exit: TerminalSessionExit): void;
  emitError(error: TerminalSessionError): void;
  writes: Array<string | Uint8Array>;
  resizes: Array<{ cols: number; rows: number }>;
  killCount: number;
  killSignals: Array<string | undefined>;
  dataHandlers: Set<(chunk: Uint8Array) => void>;
  exitHandlers: Set<(exit: TerminalSessionExit) => void>;
  errorHandlers: Set<(error: TerminalSessionError) => void>;
}

const createFakeSession = (id = "session-1"): FakeSession => {
  const writes: Array<string | Uint8Array> = [];
  const resizes: Array<{ cols: number; rows: number }> = [];
  const killSignals: Array<string | undefined> = [];
  const dataHandlers = new Set<(chunk: Uint8Array) => void>();
  const exitHandlers = new Set<(exit: TerminalSessionExit) => void>();
  const errorHandlers = new Set<(error: TerminalSessionError) => void>();
  return {
    id,
    writes,
    resizes,
    killSignals,
    dataHandlers,
    exitHandlers,
    errorHandlers,
    killCount: 0,
    write(data) {
      writes.push(data);
    },
    resize(cols, rows) {
      resizes.push({ cols, rows });
    },
    kill(signal) {
      this.killCount += 1;
      killSignals.push(signal);
    },
    onData(handler) {
      dataHandlers.add(handler);
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
    emitData(chunk) {
      for (const handler of dataHandlers) handler(chunk);
    },
    emitExit(exit) {
      for (const handler of exitHandlers) handler(exit);
    },
    emitError(error) {
      for (const handler of errorHandlers) handler(error);
    },
  };
};

describe("bindSessionToSink", () => {
  test("forwards session data to sink writes", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    bindSessionToSink(sink, session);

    const chunk = new TextEncoder().encode("hello\n");
    session.emitData(chunk);

    expect(sink.writes).toEqual([chunk]);
  });

  test("forwards sink input to session writes and calls onInput", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    const inputs: string[] = [];

    bindSessionToSink(sink, session, { onInput: (data) => inputs.push(data) });

    sink.emitInput("ls\r");

    expect(session.writes).toEqual(["ls\r"]);
    expect(inputs).toEqual(["ls\r"]);
  });

  test("forwards sink resize to session resize", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    bindSessionToSink(sink, session);

    sink.emitResize({ cols: 100, rows: 30 });

    expect(session.resizes).toEqual([{ cols: 100, rows: 30 }]);
  });

  test("invokes onExit and onError when wired", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    const exits: TerminalSessionExit[] = [];
    const errors: TerminalSessionError[] = [];

    bindSessionToSink(sink, session, {
      onExit: (exit) => exits.push(exit),
      onError: (error) => errors.push(error),
    });

    session.emitError({ message: "boom" });
    session.emitExit({ code: 1, signal: null });

    expect(errors).toEqual([{ message: "boom" }]);
    expect(exits).toEqual([{ code: 1, signal: null }]);
  });

  test("dispose detaches every subscription and stops forwarding", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    bindSessionToSink(sink, session, { onExit: () => {}, onError: () => {} });

    expect(session.dataHandlers.size).toBe(1);
    expect(session.exitHandlers.size).toBe(1);
    expect(session.errorHandlers.size).toBe(1);
    expect(sink.inputHandlers.size).toBe(1);
    expect(sink.resizeHandlers.size).toBe(1);

    const dispose = bindSessionToSink(sink, session);
    dispose();

    // The second binding's handlers are gone, but the first binding's are
    // still attached — so emitting after dispose still fires the original
    // forwarders.
    expect(session.dataHandlers.size).toBe(1);
    expect(sink.inputHandlers.size).toBe(1);
  });

  test("dispose is idempotent and survives disposer errors", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    let calls = 0;
    const originalUnsubscribe = session.onData;
    session.onData = (handler) => {
      originalUnsubscribe.call(session, handler);
      return () => {
        calls += 1;
        throw new Error("boom");
      };
    };

    const dispose = bindSessionToSink(sink, session);
    expect(() => dispose()).not.toThrow();
    expect(calls).toBe(1);
    // Idempotent — calling again is a no-op because the disposer stack drains.
    expect(() => dispose()).not.toThrow();
    expect(calls).toBe(1);
  });

  test("does not kill the session — lifecycle is the caller's responsibility", () => {
    const sink = createFakeSink();
    const session = createFakeSession();
    const dispose = bindSessionToSink(sink, session);

    dispose();

    expect(session.killCount).toBe(0);
  });
});
