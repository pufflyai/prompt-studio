import { describe, expect, test } from "bun:test";
import type { TerminalSink } from "./bind-session";
import { bindTerminalSession, createInitialTerminalSessionRequest } from "./terminal";
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

const createSession = (): TerminalSessionAdapter & { resizes: Array<{ cols: number; rows: number }> } => ({
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
  onExit(_handler: (exit: TerminalSessionExit) => void) {
    return () => {};
  },
  onError(_handler: (error: TerminalSessionError) => void) {
    return () => {};
  },
});

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
});
