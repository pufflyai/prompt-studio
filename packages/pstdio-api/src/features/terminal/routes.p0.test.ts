import { describe, expect, test } from "bun:test";
import type { WSContext, WSEvents } from "hono/ws";
import type {
  TerminalEvent,
  TerminalSessionHandle,
  TerminalWebSocketClientMessage,
  TerminalWebSocketServerMessage,
} from "pstdio-api-contracts";
import { createRetainedTerminals } from "./retained-terminals";
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

// A PTY whose output the test pushes; it runs until killed.
const createLiveHandle = (id: string) => {
  const pending: TerminalEvent[] = [];
  let wake: (() => void) | undefined;
  const kills: Array<string | undefined> = [];
  const push = (event: TerminalEvent) => {
    pending.push(event);
    wake?.();
  };
  const handle: TerminalSessionHandle = {
    id,
    write() {},
    resize() {},
    async kill(signal) {
      kills.push(signal);
      push({ kind: "exit", code: null, signal: signal ?? "SIGHUP" });
    },
    events: async function* () {
      while (true) {
        const event = pending.shift();
        if (!event) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          continue;
        }
        yield event;
        if (event.kind === "exit") return;
      }
    },
  };
  return { handle, kills, output: (text: string) => push({ kind: "data", chunk: new TextEncoder().encode(text) }) };
};

const waitFor = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) await Bun.sleep(1);
  expect(condition()).toBe(true);
};

describe("terminal WebSocket", () => {
  test("disconnect during native admission releases a late session", async () => {
    let release!: (session: TerminalSessionHandle) => void;
    let killed = 0;
    const events = createTerminalWebSocketEvents({
      openView: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    const { socket, messages } = createSocket();
    send(events, socket, {
      type: "openView",
      request: { projectId: "project", viewId: "owner.view.shell", cols: 80, rows: 24 },
    });
    events.onClose?.({} as CloseEvent, socket);
    release({
      id: "late",
      write() {},
      resize() {},
      async kill() {
        killed += 1;
      },
      events: async function* () {},
    });
    await waitFor(() => killed === 1);
    expect(messages).toEqual([]);
  });

  test("one socket cannot replace its terminal with a second open", async () => {
    let opened = 0;
    let killed = 0;
    const events = createTerminalWebSocketEvents({
      terminal: {
        openSession: () => {
          opened += 1;
          return {
            id: "single",
            write() {},
            resize() {},
            async kill() {
              killed += 1;
            },
            events: async function* () {
              await new Promise(() => {});
            },
          };
        },
      },
    });
    const { socket, closes } = createSocket();
    send(events, socket, { type: "open", request: { cols: 80, rows: 24 } });
    send(events, socket, { type: "open", request: { cols: 80, rows: 24 } });
    await waitFor(() => closes.length > 0);
    expect(opened).toBe(1);
    expect(killed).toBe(1);
  });
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

  test("keeps a keyed PTY running after its socket disconnects and reattaches it with recent output", async () => {
    const live = createLiveHandle("kept");
    let opened = 0;
    const retained = createRetainedTerminals();
    const terminal = {
      openSession: () => {
        opened += 1;
        return live.handle;
      },
    };
    const first = createSocket();
    const firstEvents = createTerminalWebSocketEvents({ terminal, retained });
    send(firstEvents, first.socket, { type: "open", request: { cols: 80, rows: 24 }, attachKey: "project/panel" });
    live.output("before ");
    await waitFor(() => first.messages.length === 2);
    firstEvents.onClose?.({} as CloseEvent, first.socket);
    live.output("while away");
    await Bun.sleep(5);

    const second = createSocket();
    const secondEvents = createTerminalWebSocketEvents({ terminal, retained });
    send(secondEvents, second.socket, { type: "open", request: { cols: 80, rows: 24 }, attachKey: "project/panel" });

    expect(opened).toBe(1);
    expect(live.kills).toEqual([]);
    expect(second.messages).toEqual([
      { type: "open", sessionId: "kept" },
      { type: "data", chunk: Buffer.from("before while away").toString("base64") },
    ]);
    send(secondEvents, second.socket, { type: "kill" });
    await waitFor(() => live.kills.length === 1);
  });

  test("starts a separate keyed PTY while the existing one is attached elsewhere", () => {
    const handles = [createLiveHandle("first"), createLiveHandle("second")];
    const retained = createRetainedTerminals();
    const terminal = { openSession: () => handles.shift()!.handle };
    const windows = [createSocket(), createSocket()];
    for (const window of windows) {
      const events = createTerminalWebSocketEvents({ terminal, retained });
      send(events, window.socket, { type: "open", request: { cols: 80, rows: 24 }, attachKey: "project/panel" });
    }

    expect(windows.map((window) => window.messages[0])).toEqual([
      { type: "open", sessionId: "first" },
      { type: "open", sessionId: "second" },
    ]);
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
