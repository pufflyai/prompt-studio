import { describe, expect, test } from "bun:test";
import type { TerminalHostEvent, TerminalSessionOperation } from "../api/terminal";
import type { GuestHost } from "./define-extension-view";
import { createTerminalSessionBridge } from "./terminal-session-bridge";

const createFakeHost = () => {
  const calls: TerminalSessionOperation[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const host: GuestHost = {
    call: async <TResult>(method: string, params?: unknown) => {
      if (method !== "terminal.session") throw new Error(`Unexpected capability: ${method}`);
      const operation = params as TerminalSessionOperation;
      calls.push(operation);
      if (operation.operation === "open") return { operation: "open", sessionId: "session-1" } as TResult;
      return { operation: operation.operation, accepted: true } as TResult;
    },
    onEvent: (scope, handler) => {
      const handlers = listeners.get(scope) ?? new Set();
      handlers.add(handler);
      listeners.set(scope, handlers);
      return () => handlers.delete(handler);
    },
  };

  const emit = (event: TerminalHostEvent) => {
    for (const handler of listeners.get("terminal.session") ?? []) handler(event);
  };

  const listenerCount = () => listeners.get("terminal.session")?.size ?? 0;

  return { host, calls, emit, listenerCount };
};

describe("createTerminalSessionBridge", () => {
  test("open subscribes to host events and returns a session addressing the returned id", async () => {
    const fake = createFakeHost();
    const bridge = createTerminalSessionBridge(fake.host);

    const session = await bridge.openSession({ cols: 80, rows: 24 });

    expect(session.id).toBe("session-1");
    expect(fake.calls).toEqual([
      { operation: "open", request: { cols: 80, rows: 24 } },
      { operation: "subscribe", sessionId: "session-1" },
    ]);
  });

  test("write, resize, and kill send serializable operations for the session", async () => {
    const fake = createFakeHost();
    const session = await createTerminalSessionBridge(fake.host).openSession({ cols: 80, rows: 24 });

    session.write("ls\r");
    session.resize(100, 30);
    await session.kill("SIGTERM");

    expect(fake.calls.slice(2)).toEqual([
      { operation: "write", sessionId: "session-1", data: "ls\r" },
      { operation: "resize", sessionId: "session-1", cols: 100, rows: 30 },
      { operation: "kill", sessionId: "session-1", signal: "SIGTERM" },
    ]);
  });

  test("host data and exit events reach subscribers of this session only", async () => {
    const fake = createFakeHost();
    const session = await createTerminalSessionBridge(fake.host).openSession({ cols: 80, rows: 24 });

    const chunks: Uint8Array[] = [];
    const exits: unknown[] = [];
    session.onData((chunk) => chunks.push(chunk));
    session.onExit((exit) => exits.push(exit));

    fake.emit({ sessionId: "other", kind: "data", chunk: new Uint8Array([1]) });
    fake.emit({ sessionId: "session-1", kind: "data", chunk: new Uint8Array([104, 105]) });
    fake.emit({ sessionId: "session-1", kind: "exit", code: 0, signal: null });

    expect(chunks).toEqual([new Uint8Array([104, 105])]);
    expect(exits).toEqual([{ code: 0, signal: null }]);
  });

  test("data and exit arriving before local handlers attach are buffered and replayed", async () => {
    const fake = createFakeHost();
    const session = await createTerminalSessionBridge(fake.host).openSession({ cols: 80, rows: 24 });

    // The host may start streaming right after `subscribe`, before the terminal
    // component binds its handlers (e.g. a scripted banner).
    fake.emit({ sessionId: "session-1", kind: "data", chunk: new Uint8Array([36, 32]) });
    fake.emit({ sessionId: "session-1", kind: "exit", code: 0, signal: null });

    const chunks: Uint8Array[] = [];
    const exits: unknown[] = [];
    session.onData((chunk) => chunks.push(chunk));
    session.onExit((exit) => exits.push(exit));

    expect(chunks).toEqual([new Uint8Array([36, 32])]);
    expect(exits).toEqual([{ code: 0, signal: null }]);
  });

  test("write and resize rejections surface through onError handlers", async () => {
    const fake = createFakeHost();
    const failingHost: GuestHost = {
      ...fake.host,
      call: async <TResult>(method: string, params?: unknown) => {
        const operation = params as TerminalSessionOperation;
        if (operation.operation === "write" || operation.operation === "resize") {
          throw new Error(`session gone: ${operation.operation}`);
        }
        return fake.host.call<TResult>(method, params);
      },
    };
    const session = await createTerminalSessionBridge(failingHost).openSession({ cols: 80, rows: 24 });

    const errors: { message: string }[] = [];
    session.onError((error) => errors.push(error));

    session.write("ls\r");
    session.resize(100, 30);
    await Bun.sleep(0);

    expect(errors).toEqual([{ message: "session gone: write" }, { message: "session gone: resize" }]);
  });

  test("exit tears down the host event subscription", async () => {
    const fake = createFakeHost();
    const session = await createTerminalSessionBridge(fake.host).openSession({ cols: 80, rows: 24 });
    session.onExit(() => {});
    expect(fake.listenerCount()).toBe(1);

    fake.emit({ sessionId: "session-1", kind: "exit", code: 0, signal: null });

    expect(fake.listenerCount()).toBe(0);
  });
});
