import { afterEach, describe, expect, test } from "bun:test";
import type { TerminalWebSocketServerMessage } from "pstdio-api-contracts";
import { openDashboardTerminalSession } from "./api-terminal-session-opener";

const nativeWebSocket = globalThis.WebSocket;

class TestWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static latest: TestWebSocket;

  readonly sent: string[] = [];
  readonly url: string;
  readyState = TestWebSocket.OPEN;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    TestWebSocket.latest = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.emitClose(true);
  }

  emitOpen() {
    this.dispatchEvent(new Event("open"));
  }

  emitMessage(message: TerminalWebSocketServerMessage) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
  }

  emitClose(wasClean: boolean) {
    const event = new Event("close");
    Object.defineProperty(event, "wasClean", { value: wasClean });
    this.dispatchEvent(event);
  }
}

afterEach(() => {
  globalThis.WebSocket = nativeWebSocket;
});

describe("openDashboardTerminalSession", () => {
  test("opens a same-origin cookie-authenticated URL without credentials in the query", async () => {
    globalThis.WebSocket = TestWebSocket as unknown as typeof WebSocket;

    const sessionPromise = openDashboardTerminalSession({ cols: 80, rows: 24 });
    TestWebSocket.latest.emitOpen();
    TestWebSocket.latest.emitMessage({ type: "open", sessionId: "session-1" });
    const session = await sessionPromise;

    expect(TestWebSocket.latest.url).toBe("ws://localhost/v1/terminal");
    expect(TestWebSocket.latest.url).not.toContain("token");
    session.kill();
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
