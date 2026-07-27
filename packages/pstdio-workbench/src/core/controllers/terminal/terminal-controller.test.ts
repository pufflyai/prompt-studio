import { describe, expect, test } from "bun:test";
import {
  createWorkbenchTerminalController,
  type WorkbenchTerminalSessionAdapter,
  type WorkbenchTerminalSessionRequest,
} from "./terminal-controller";

const createFakeAdapter = (id: string) => {
  const dataHandlers = new Set<(chunk: Uint8Array) => void>();
  const titleHandlers = new Set<(title: string) => void>();
  const exitHandlers = new Set<(exit: { code: number | null; signal: string | null }) => void>();
  const calls: string[] = [];

  const adapter: WorkbenchTerminalSessionAdapter = {
    id,
    write: (data) => calls.push(`write:${typeof data === "string" ? data : "bytes"}`),
    resize: (cols, rows) => calls.push(`resize:${cols}x${rows}`),
    kill: (signal) => {
      calls.push(`kill:${signal ?? "default"}`);
      for (const handler of exitHandlers) handler({ code: null, signal: signal ?? null });
    },
    onData: (handler) => {
      dataHandlers.add(handler);
      return () => dataHandlers.delete(handler);
    },
    onTitle: (handler) => {
      titleHandlers.add(handler);
      return () => titleHandlers.delete(handler);
    },
    onExit: (handler) => {
      exitHandlers.add(handler);
      return () => exitHandlers.delete(handler);
    },
    onError: () => () => {},
  };

  return {
    adapter,
    calls,
    emitData: (chunk: Uint8Array) => {
      for (const handler of dataHandlers) handler(chunk);
    },
    emitTitle: (title: string) => {
      for (const handler of titleHandlers) handler(title);
    },
    emitExit: (exit: { code: number | null; signal: string | null }) => {
      for (const handler of exitHandlers) handler(exit);
    },
  };
};

const request: WorkbenchTerminalSessionRequest = { cols: 80, rows: 24 };

describe("createWorkbenchTerminalController", () => {
  test("is unavailable until a session presenter is set", async () => {
    const terminal = createWorkbenchTerminalController();
    expect(terminal.isAvailable()).toBe(false);
    await expect(terminal.open({ request })).rejects.toThrow(/terminal/i);

    terminal.setSessionOpener(async () => createFakeAdapter("s1").adapter);
    expect(terminal.isAvailable()).toBe(true);
  });

  test("open registers a session and returns only a serializable session id", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);

    const opened = await terminal.open({ request, title: "Shell" });
    expect(opened).toEqual({ sessionId: "s1" });
    expect(terminal.listSessions()).toMatchObject([{ id: "s1", status: "running", title: "Shell" }]);
  });

  test("write, resize, and kill address the session by id", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ request });

    terminal.write({ sessionId: "s1", data: "ls\r" });
    terminal.resize({ sessionId: "s1", cols: 100, rows: 30 });
    await terminal.kill({ sessionId: "s1", signal: "SIGTERM" });

    expect(fake.calls).toEqual(["write:ls\r", "resize:100x30", "kill:SIGTERM"]);
    expect(terminal.getSession("s1")?.status).toBe("killed");
  });

  test("subscribers receive data and exit events for their session", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ request });

    const chunks: Uint8Array[] = [];
    const exits: unknown[] = [];
    terminal.subscribe("s1", {
      onData: (chunk) => chunks.push(chunk),
      onExit: (exit) => exits.push(exit),
    });

    fake.emitData(new Uint8Array([104, 105]));
    fake.emitExit({ code: 0, signal: null });

    expect(chunks).toEqual([new Uint8Array([104, 105])]);
    expect(exits).toEqual([{ code: 0, signal: null }]);
    expect(terminal.getSession("s1")?.status).toBe("exited");
  });

  test("replays initial data emitted before the renderer subscribes", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ request });

    fake.emitData(new Uint8Array([112, 114, 111, 109, 112, 116]));

    const chunks: Uint8Array[] = [];
    terminal.subscribe("s1", {
      onData: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual([new Uint8Array([112, 114, 111, 109, 112, 116])]);
  });

  test("reflects the session's foreground process name as its title", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ request, title: "Terminal 1" });

    expect(terminal.getSession("s1")?.title).toBe("Terminal 1");

    fake.emitTitle("zsh");
    expect(terminal.getSession("s1")?.title).toBe("zsh");

    fake.emitTitle("opencode");
    expect(terminal.getSession("s1")?.title).toBe("opencode");
  });

  test("operations on unknown sessions throw", async () => {
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => createFakeAdapter("s1").adapter);

    expect(() => terminal.write({ sessionId: "nope", data: "x" })).toThrow(/unknown/i);
    expect(() => terminal.resize({ sessionId: "nope", cols: 1, rows: 1 })).toThrow(/unknown/i);
    await expect(terminal.kill({ sessionId: "nope" })).rejects.toThrow(/unknown/i);
    expect(() => terminal.subscribe("nope", {})).toThrow(/unknown/i);
  });

  test("dispose kills every live session", async () => {
    const first = createFakeAdapter("s1");
    const second = createFakeAdapter("s2");
    const adapters = [first, second];
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => adapters.shift()?.adapter as WorkbenchTerminalSessionAdapter);
    await terminal.open({ request });
    await terminal.open({ request });

    await terminal.dispose();

    expect(first.calls).toContain("kill:default");
    expect(second.calls).toContain("kill:default");
    expect(terminal.listSessions().every((session) => session.status !== "running")).toBe(true);
  });

  test("store notifies on session changes", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);

    const statuses: string[][] = [];
    terminal.store.subscribe((state) => {
      statuses.push(Object.values(state.sessionsById).map((session) => session.status));
    });

    await terminal.open({ request });
    fake.emitExit({ code: 0, signal: null });

    expect(statuses.at(0)).toEqual(["running"]);
    expect(statuses.at(-1)).toEqual(["exited"]);
  });
});
