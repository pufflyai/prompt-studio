import { describe, expect, test } from "bun:test";
import type { TerminalSink } from "./bind-session";
import {
  bindTerminalSession,
  bindTerminalSessionWithCallbackRefs,
  createInitialTerminalSessionRequest,
} from "./terminal";
import type { TerminalSessionAdapter, TerminalSessionError, TerminalSessionExit } from "./types";

describe("createInitialTerminalSessionRequest", () => {
  test("defaults initial geometry without depending on live resize measurements", () => {
    const request = { cwd: "/workspace" };

    expect(createInitialTerminalSessionRequest(request)).toEqual({ cwd: "/workspace", cols: 80, rows: 24 });
    expect(createInitialTerminalSessionRequest({ ...request })).toEqual({ cwd: "/workspace", cols: 80, rows: 24 });
  });

  test("preserves explicit initial geometry", () => {
    expect(createInitialTerminalSessionRequest({ cols: 120, rows: 40 })).toEqual({ cols: 120, rows: 40 });
  });
});

const createSink = (): TerminalSink => ({
  write() {},
  onInput() {
    return () => {};
  },
  onResize() {
    return () => {};
  },
});

const createSession = (): TerminalSessionAdapter & {
  emitExit(exit: TerminalSessionExit): void;
  resizes: Array<{ cols: number; rows: number }>;
} => {
  const exitHandlers = new Set<(exit: TerminalSessionExit) => void>();
  return {
    id: "session-1",
    resizes: [],
    write() {},
    resize(cols, rows) {
      this.resizes.push({ cols, rows });
    },
    kill() {},
    onData() {
      return () => {};
    },
    onExit(handler: (exit: TerminalSessionExit) => void) {
      exitHandlers.add(handler);
      return () => exitHandlers.delete(handler);
    },
    onError(_handler: (error: TerminalSessionError) => void) {
      return () => {};
    },
    emitExit(exit) {
      for (const handler of exitHandlers) handler(exit);
    },
  };
};

describe("bindTerminalSession", () => {
  test("forwards already-fitted terminal geometry when the session opens", () => {
    const session = createSession();
    const resizes: Array<{ cols: number; rows: number }> = [];
    session.resize = (cols, rows) => resizes.push({ cols, rows });
    const openedSessions: string[] = [];

    bindTerminalSession({ cols: 120, rows: 40 }, createSink(), session, {
      onSessionOpen: (sessionId) => openedSessions.push(sessionId),
    });

    expect(resizes).toEqual([{ cols: 120, rows: 40 }]);
    expect(openedSessions).toEqual(["session-1"]);
  });

  test("reads session callbacks from refs without rebinding an open session", () => {
    const session = createSession();
    const openedSessions: string[] = [];
    const exits: TerminalSessionExit[] = [];
    const onSessionOpen = { current: (sessionId: string) => openedSessions.push(`first:${sessionId}`) };
    const onSessionExit = { current: (exit: TerminalSessionExit) => exits.push(exit) };

    bindTerminalSessionWithCallbackRefs({ cols: 120, rows: 40 }, createSink(), session, {
      onSessionOpen,
      onSessionExit,
    });
    onSessionOpen.current = (sessionId) => openedSessions.push(`second:${sessionId}`);
    onSessionExit.current = (exit) => exits.push({ ...exit, signal: "latest" });

    session.emitExit({ code: 0, signal: null });

    expect(openedSessions).toEqual(["first:session-1"]);
    expect(exits).toEqual([{ code: 0, signal: "latest" }]);
  });
});
