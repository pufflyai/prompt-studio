import { describe, expect, test } from "bun:test";
import type { WSContext, WSEvents } from "hono/ws";
import type {
  TerminalSessionHandle,
  TerminalWebSocketClientMessage,
  TerminalWebSocketServerMessage,
} from "pstdio-api-contracts";
import { createTerminalWebSocketEvents, isTerminalWebSocketOriginAllowed } from "./routes";

const createSocket = () => {
  const messages: TerminalWebSocketServerMessage[] = [];
  const closes: Array<{ code?: number; reason?: string }> = [];
  const socket = {
    send(data: string) {
      messages.push(JSON.parse(data) as TerminalWebSocketServerMessage);
    },
    close(code?: number, reason?: string) {
      closes.push({ code, reason });
    },
  } as unknown as WSContext;
  return { socket, messages, closes };
};

const send = (events: WSEvents, socket: WSContext, message: TerminalWebSocketClientMessage) => {
  events.onMessage?.({ data: JSON.stringify(message) } as MessageEvent<string>, socket);
};

const waitFor = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) await Bun.sleep(1);
  expect(condition()).toBe(true);
};

describe("terminal WebSocket", () => {
  test("allows only same-origin or explicitly trusted browser handshakes", () => {
    const request = (origin?: string) =>
      new Request("http://localhost:19841/v1/terminal", {
        headers: origin ? { origin } : undefined,
      });

    expect(isTerminalWebSocketOriginAllowed(request())).toBe(true);
    expect(isTerminalWebSocketOriginAllowed(request("http://localhost:19841"))).toBe(true);
    expect(isTerminalWebSocketOriginAllowed(request("http://localhost:5173"), ["http://localhost:5173"])).toBe(true);
    expect(isTerminalWebSocketOriginAllowed(request("https://attacker.example"), ["http://localhost:5173"])).toBe(
      false,
    );
  });

  test("streams PTY events and closes after exit", async () => {
    const handle: TerminalSessionHandle = {
      id: "session-1",
      write() {},
      resize() {},
      async kill() {},
      events: async function* () {
        yield { kind: "data", chunk: new TextEncoder().encode("hello") };
        yield { kind: "title", title: "bash" };
        yield { kind: "exit", code: 0, signal: null };
      },
    };
    const events = createTerminalWebSocketEvents({ terminal: { openSession: () => handle } });
    const { socket, messages, closes } = createSocket();

    send(events, socket, { type: "open", request: { cols: 80, rows: 24 } });
    await waitFor(() => closes.length === 1);

    expect(messages).toEqual([
      { type: "open", sessionId: "session-1" },
      { type: "data", chunk: Buffer.from("hello").toString("base64") },
      { type: "title", title: "bash" },
      { type: "exit", code: 0, signal: null },
    ]);
    expect(closes).toEqual([{ code: 1000, reason: undefined }]);
  });

  test("writes, resizes, and kills the socket's PTY session", async () => {
    const writes: string[] = [];
    const resizes: Array<{ cols: number; rows: number }> = [];
    const kills: Array<string | undefined> = [];
    let releaseEvents: (() => void) | undefined;
    const handle: TerminalSessionHandle = {
      id: "session-2",
      write(data) {
        writes.push(Buffer.from(data).toString("utf8"));
      },
      resize(cols, rows) {
        resizes.push({ cols, rows });
      },
      async kill(signal) {
        kills.push(signal);
        releaseEvents?.();
      },
      events: async function* () {
        await new Promise<void>((resolve) => {
          releaseEvents = resolve;
        });
      },
    };
    const events = createTerminalWebSocketEvents({ terminal: { openSession: () => handle } });
    const { socket, closes } = createSocket();

    send(events, socket, { type: "open", request: { cols: 80, rows: 24 } });
    send(events, socket, { type: "write", data: Buffer.from("echo test\r").toString("base64") });
    send(events, socket, { type: "resize", cols: 120, rows: 40 });
    send(events, socket, { type: "kill", signal: "SIGTERM" });
    await waitFor(() => closes.length === 1);

    expect(writes).toEqual(["echo test\r"]);
    expect(resizes).toEqual([{ cols: 120, rows: 40 }]);
    expect(kills).toEqual(["SIGTERM"]);
  });

  test("kills a live PTY when its socket disconnects", async () => {
    let killed = 0;
    const handle: TerminalSessionHandle = {
      id: "session-3",
      write() {},
      resize() {},
      async kill() {
        killed += 1;
      },
      events: async function* () {
        await new Promise(() => {});
      },
    };
    const events = createTerminalWebSocketEvents({ terminal: { openSession: () => handle } });
    const { socket } = createSocket();

    send(events, socket, { type: "open", request: { cols: 80, rows: 24 } });
    events.onClose?.({} as CloseEvent, socket);
    await waitFor(() => killed === 1);

    expect(killed).toBe(1);
  });

  test("reports hosts where terminal sessions are unavailable", () => {
    const events = createTerminalWebSocketEvents({ terminal: undefined });
    const { socket, messages, closes } = createSocket();

    send(events, socket, { type: "open", request: { cols: 80, rows: 24 } });

    expect(messages).toEqual([{ type: "error", message: "Terminal sessions are not available on this host." }]);
    expect(closes).toEqual([{ code: 1011, reason: "Terminal unavailable" }]);
  });

  test("reports terminal open failures without throwing from the WebSocket handler", () => {
    const events = createTerminalWebSocketEvents({
      terminal: {
        openSession: () => {
          throw new Error("Terminal working directory does not exist: /missing-workspace");
        },
      },
    });
    const { socket, messages, closes } = createSocket();

    expect(() => send(events, socket, { type: "open", request: { cols: 80, rows: 24 } })).not.toThrow();

    expect(messages).toEqual([
      { type: "error", message: "Terminal working directory does not exist: /missing-workspace" },
    ]);
    expect(closes).toEqual([{ code: 1011, reason: "Terminal session failed" }]);
  });
});
