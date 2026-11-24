import { afterEach, describe, expect, test } from "bun:test";
import type { TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { openDashboardTerminalSession } from "./api-terminal-session-opener";

const nativeWebSocket = globalThis.WebSocket;
const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
    terminalWebSocketUrl?: string;
  };
};

class TestWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static latest: TestWebSocket;

  readonly sent: string[] = [];
  readonly url: string;
  readyState = TestWebSocket.OPEN;
  closed = false;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    TestWebSocket.latest = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.emitClose(true);
  }

  emitOpen() {
    this.dispatchEvent(new Event("open"));
  }

  emitMessage(message: TerminalWebSocketServerMessage) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
  }

  emitClose(wasClean: boolean, code = wasClean ? 1000 : 1006) {
    this.readyState = 3;
    const event = new Event("close");
    Object.defineProperties(event, { wasClean: { value: wasClean }, code: { value: code } });
    this.dispatchEvent(event);
  }
}

afterEach(() => {
  globalThis.WebSocket = nativeWebSocket;
  delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
});

describe("openDashboardTerminalSession", () => {
  test("native view admission sends its project/view binding and dimensions, with launch settings resolved on the host", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
    const binding = {
      projectId: "project",
      viewId: "owner.view.shell",
      resource: { type: "workspace", id: "workspace", projectId: "project" },
    };
    const opening = openDashboardTerminalSession(
      { cols: 80, rows: 24, cwd: "/renderer", command: ["renderer-command"] },
      binding,
    );
    const socket = TestWebSocket.latest;
    socket.emitOpen();
    expect(socket.sent.map((message) => JSON.parse(message))).toEqual([
      { type: "openView", request: { ...binding, cols: 80, rows: 24 } },
    ]);
    socket.emitMessage({ type: "open", sessionId: "host-session" });
    const session = await opening;
    expect(session.id).toBe("host-session");
    const stopping = session.kill();
    socket.emitClose(true);
    await stopping;
  });
  test("opens a same-origin cookie-authenticated URL without credentials in the query", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

    const sessionPromise = openDashboardTerminalSession({ cols: 80, rows: 24 });
    TestWebSocket.latest.emitOpen();
    TestWebSocket.latest.emitMessage({ type: "open", sessionId: "session-1" });
    const session = await sessionPromise;

    expect(TestWebSocket.latest.url).toBe("ws://localhost/v1/terminal");
    expect(TestWebSocket.latest.url).not.toContain("token");
    const stopping = session.kill();
    TestWebSocket.latest.emitClose(true);
    await stopping;
  });

  test("uses the complete runtime terminal WebSocket URL", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = {
      apiBaseUrl: "http://dashboard.test",
      terminalWebSocketUrl: "wss://terminal.test/prefix/pty?channel=dev",
    };

    const sessionPromise = openDashboardTerminalSession({ cols: 80, rows: 24 });
    TestWebSocket.latest.emitOpen();
    TestWebSocket.latest.emitMessage({ type: "open", sessionId: "session-1" });
    const session = await sessionPromise;

    expect(TestWebSocket.latest.url).toBe("wss://terminal.test/prefix/pty?channel=dev");
    const stopping = session.kill();
    TestWebSocket.latest.emitClose(true);
    await stopping;
  });

  test("a keyed terminal detaches without killing its shell, and kills only when asked", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

    const sessionPromise = openDashboardTerminalSession({ cols: 80, rows: 24 }, undefined, undefined, "p/terminal-1");
    const socket = TestWebSocket.latest;
    socket.emitOpen();
    socket.emitMessage({ type: "open", sessionId: "session-1" });
    const session = await sessionPromise;
    session.detach?.();
    await expect(Promise.resolve(session.kill())).rejects.toThrow("could not be confirmed");

    expect(socket.sent.map((message) => JSON.parse(message))).toEqual([
      { type: "open", request: { cols: 80, rows: 24 }, attachKey: "p/terminal-1" },
    ]);
  });

  test("reports an unexpected connection loss after the session opens", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

    const sessionPromise = openDashboardTerminalSession({ cols: 80, rows: 24 });
    const socket = TestWebSocket.latest;
    socket.emitOpen();
    socket.emitMessage({ type: "open", sessionId: "session-1" });
    const session = await sessionPromise;
    const errors: string[] = [];
    session.onError((error) => errors.push(error.message));

    socket.emitClose(false);

    expect(errors).toEqual(["Terminal connection lost."]);
  });
});

test("cancelling pending native admission closes its socket without waiting for the host", async () => {
  globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
  const controller = new AbortController();
  const admission = openDashboardTerminalSession(
    { cols: 80, rows: 24 },
    { projectId: "project", viewId: "owner.view.shell" },
    controller.signal,
  );
  const rejected = admission.catch((error) => error);
  const socket = TestWebSocket.latest;
  socket.emitOpen();
  controller.abort(new Error("Admission cancelled"));
  expect(await rejected).toMatchObject({ message: "Admission cancelled" });
  expect(socket.closed).toBe(true);
});

test("stopping a terminal shares one request and waits for its native acknowledgement", async () => {
  globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
  const opening = openDashboardTerminalSession({ cols: 80, rows: 24 });
  const socket = TestWebSocket.latest;
  socket.emitOpen();
  socket.emitMessage({ type: "open", sessionId: "session" });
  const session = await opening;

  let complete = false;
  const stopping = Promise.resolve(session.kill()).then(() => {
    complete = true;
  });
  const duplicate = session.kill();
  await Promise.resolve();
  expect(complete).toBe(false);
  expect(socket.closed).toBe(false);
  expect(socket.sent.map((message) => JSON.parse(message).type)).toEqual(["open", "kill"]);
  socket.emitClose(true);
  await Promise.all([stopping, duplicate]);
  expect(complete).toBe(true);
});

test("a lost connection cannot acknowledge a terminal stop", async () => {
  globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;
  const opening = openDashboardTerminalSession({ cols: 80, rows: 24 });
  const socket = TestWebSocket.latest;
  socket.emitOpen();
  socket.emitMessage({ type: "open", sessionId: "session" });
  const session = await opening;
  const stopping = Promise.resolve(session.kill());
  socket.emitClose(false);
  await expect(stopping).rejects.toThrow("could not be confirmed");
  await expect(Promise.resolve(session.kill())).rejects.toThrow("could not be confirmed");
  expect(socket.sent.map((message) => JSON.parse(message).type)).toEqual(["open", "kill"]);
});
