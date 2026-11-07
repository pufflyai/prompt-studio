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

describe("terminal presentation lifetime", () => {
  test("a fast command replays its output and exit without becoming a running ghost", async () => {
    const terminal = createWorkbenchTerminalController();
    const fake = createFakeAdapter("fast");
    let detached = 0;
    fake.adapter.onData = (handler) => {
      handler(new TextEncoder().encode("finished"));
      return () => {
        detached += 1;
      };
    };
    fake.adapter.onExit = (handler) => {
      handler({ code: 7, signal: null });
      return () => {
        detached += 1;
      };
    };
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ bindingId: "shell", request });
    expect(terminal.getSession("fast")).toMatchObject({ status: "exited", exit: { code: 7, signal: null } });
    const data: string[] = [];
    const exits: unknown[] = [];
    terminal.subscribe("fast", {
      onData: (chunk) => data.push(new TextDecoder().decode(chunk)),
      onExit: (exit) => exits.push(exit),
    });
    expect(data).toEqual(["finished"]);
    expect(exits).toEqual([{ code: 7, signal: null }]);
    expect(detached).toBe(2);
    await terminal.dispose();
    expect(fake.calls).toEqual([]);
  });

  test("remounting an exited presentation retains its output and exit until explicit close", async () => {
    const terminal = createWorkbenchTerminalController();
    let opens = 0;
    const fake = createFakeAdapter("retained");
    terminal.setSessionOpener(async () => {
      opens += 1;
      return fake.adapter;
    });
    await terminal.open({ bindingId: "shell", ownerId: "console", request });
    fake.emitData(new TextEncoder().encode("last output"));
    fake.emitExit({ code: 0, signal: null });
    expect(await terminal.open({ bindingId: "shell", ownerId: "console", request })).toEqual({ sessionId: "retained" });
    const output: string[] = [];
    terminal.subscribe("retained", { onData: (chunk) => output.push(new TextDecoder().decode(chunk)) });
    expect(output).toEqual(["last output"]);
    terminal.write({ sessionId: "retained", data: "late input" });
    terminal.resize({ sessionId: "retained", cols: 120, rows: 40 });
    expect(opens).toBe(1);
    expect(fake.calls).toEqual([]);
    await terminal.killBinding("shell", "console");
    await terminal.open({ bindingId: "shell", ownerId: "console", request });
    expect(opens).toBe(2);
    await terminal.dispose();
  });
  test("the same placement id in different owners never shares a terminal", async () => {
    const terminal = createWorkbenchTerminalController();
    const first = createFakeAdapter("first");
    const second = createFakeAdapter("second");
    const pending = [first, second];
    terminal.setSessionOpener(async () => pending.shift()!.adapter);
    expect(await terminal.open({ bindingId: "shell", ownerId: "project-a", request })).toEqual({ sessionId: "first" });
    expect(await terminal.open({ bindingId: "shell", ownerId: "project-b", request })).toEqual({ sessionId: "second" });
    await terminal.killBinding("shell", "project-b");
    expect(first.calls).toEqual([]);
    expect(second.calls).toEqual(["kill:default"]);
    await terminal.dispose();
  });
  test("disposing a terminal owner closes its pending and hidden sessions only", async () => {
    const terminal = createWorkbenchTerminalController();
    const hidden = createFakeAdapter("hidden");
    const pending = createFakeAdapter("pending");
    const other = createFakeAdapter("other");
    let release!: (adapter: WorkbenchTerminalSessionAdapter) => void;
    let opens = 0;
    terminal.setSessionOpener(async () => {
      opens += 1;
      if (opens === 1) return hidden.adapter;
      if (opens === 2) return other.adapter;
      return await new Promise((resolve) => {
        release = resolve;
      });
    });
    await terminal.open({ bindingId: "hidden", ownerId: "console", request });
    await terminal.open({ bindingId: "other", ownerId: "other", request });
    const opening = terminal.open({ bindingId: "pending", ownerId: "console", request });
    const closing = terminal.killOwner("console");
    release(pending.adapter);
    await opening;
    await closing;
    expect(hidden.calls).toEqual(["kill:default"]);
    expect(pending.calls).toEqual(["kill:default"]);
    expect(other.calls).toEqual([]);
    await terminal.dispose();
  });

  test("host disposal cleans a terminal admitted after teardown", async () => {
    const terminal = createWorkbenchTerminalController();
    const late = createFakeAdapter("late");
    let release!: (adapter: WorkbenchTerminalSessionAdapter) => void;
    terminal.setSessionOpener(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const opening = terminal.open({ request });
    const closing = terminal.dispose();
    release(late.adapter);
    await opening.catch(() => undefined);
    await closing;
    expect(late.calls).toEqual(["kill:default"]);
    expect(terminal.listSessions().some((session) => session.status === "running")).toBe(false);
    await expect(terminal.open({ request })).rejects.toThrow();
  });
});

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

  test("reuses a live session for the same terminal placement binding", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    let openCount = 0;
    terminal.setSessionOpener(async () => {
      openCount += 1;
      return fake.adapter;
    });

    const first = await terminal.open({ bindingId: "workspace-1/terminal-1", request });
    const restored = await terminal.open({ bindingId: "workspace-1/terminal-1", request });

    expect(restored).toEqual(first);
    expect(openCount).toBe(1);
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

  test("replays terminal history when a renderer subscribes again", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ bindingId: "workspace-1/terminal-1", request });

    fake.emitData(new Uint8Array([111, 110, 101]));
    const unsubscribe = terminal.subscribe("s1", { onData: () => undefined });
    unsubscribe();
    fake.emitData(new Uint8Array([116, 119, 111]));

    const restored: Uint8Array[] = [];
    terminal.subscribe("s1", { onData: (chunk) => restored.push(chunk) });

    expect(restored).toEqual([new Uint8Array([111, 110, 101]), new Uint8Array([116, 119, 111])]);
  });

  test("kills a live session by terminal placement binding", async () => {
    const fake = createFakeAdapter("s1");
    const terminal = createWorkbenchTerminalController();
    terminal.setSessionOpener(async () => fake.adapter);
    await terminal.open({ bindingId: "workspace-1/terminal-1", request });

    await terminal.killBinding("workspace-1/terminal-1");

    expect(fake.calls).toEqual(["kill:default"]);
    expect(terminal.getSession("s1")?.status).toBe("killed");
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
