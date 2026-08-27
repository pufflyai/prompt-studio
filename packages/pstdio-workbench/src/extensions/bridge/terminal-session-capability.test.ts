import { describe, expect, test } from "bun:test";
import { createHostCapabilityGate, type HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher, type HostEventMessage } from "pstdio-extensions/bridge/host";
import { createWorkbenchCore, type WorkbenchTerminalSessionAdapter } from "../../core";
import { createTerminalSessionCapability } from "./terminal-session-capability";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const createScriptedAdapter = (id: string) => {
  const dataHandlers = new Set<(chunk: Uint8Array) => void>();
  const exitHandlers = new Set<(exit: { code: number | null; signal: string | null }) => void>();
  const calls: string[] = [];

  const adapter: WorkbenchTerminalSessionAdapter = {
    id,
    write: (data) => {
      calls.push(`write:${data}`);
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      for (const handler of dataHandlers) handler(new TextEncoder().encode(text));
    },
    resize: (cols, rows) => calls.push(`resize:${cols}x${rows}`),
    kill: (signal) => {
      calls.push(`kill:${signal ?? "default"}`);
      for (const handler of exitHandlers) handler({ code: null, signal: signal ?? null });
    },
    onData: (handler) => {
      dataHandlers.add(handler);
      return () => dataHandlers.delete(handler);
    },
    onTitle: () => () => {},
    onExit: (handler) => {
      exitHandlers.add(handler);
      return () => exitHandlers.delete(handler);
    },
    onError: () => () => {},
  };

  return { adapter, calls, handlerCounts: () => ({ data: dataHandlers.size, exit: exitHandlers.size }) };
};

const setupTerminal = () => {
  const workbench = createWorkbenchCore();
  const scripted = createScriptedAdapter("session-1");
  workbench.terminal.setSessionOpener(async () => scripted.adapter);
  const events: HostEventMessage[] = [];
  const hostEvents = createHostEventPublisher();
  hostEvents.bind((message) => events.push(message));
  return { workbench, scripted, hostEvents, events };
};

describe("createTerminalSessionCapability", () => {
  test("open returns only a serializable session id", async () => {
    const { workbench, hostEvents } = setupTerminal();
    const capability = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });

    const result = await capability({ operation: "open", request: { cols: 80, rows: 24 } });

    expect(result).toEqual({ operation: "open", sessionId: "session-1" });
  });

  test("write, resize, and kill call the matching host session methods", async () => {
    const { workbench, scripted, hostEvents } = setupTerminal();
    const capability = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });
    await capability({ operation: "open", request: { cols: 80, rows: 24 } });

    await expect(capability({ operation: "write", sessionId: "session-1", data: "ls\r" })).resolves.toEqual({
      operation: "write",
      accepted: true,
    });
    await expect(capability({ operation: "resize", sessionId: "session-1", cols: 120, rows: 40 })).resolves.toEqual({
      operation: "resize",
      accepted: true,
    });
    await expect(capability({ operation: "kill", sessionId: "session-1", signal: "SIGTERM" })).resolves.toEqual({
      operation: "kill",
      accepted: true,
    });

    expect(scripted.calls).toEqual(["write:ls\r", "resize:120x40", "kill:SIGTERM"]);
  });

  test("subscribe delivers data and exit events through the host event publisher", async () => {
    const { workbench, scripted, hostEvents, events } = setupTerminal();
    const capability = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });
    await capability({ operation: "open", request: { cols: 80, rows: 24 } });
    await capability({ operation: "subscribe", sessionId: "session-1" });

    await capability({ operation: "write", sessionId: "session-1", data: "hi" });
    scripted.adapter.kill();

    expect(events).toEqual([
      {
        scope: "terminal.session",
        payload: { sessionId: "session-1", kind: "data", chunk: new TextEncoder().encode("hi") },
      },
      {
        scope: "terminal.session",
        payload: { sessionId: "session-1", kind: "exit", code: null, signal: null },
      },
    ]);
  });

  test("subscribe removes terminal handlers when the webview event channel disconnects", async () => {
    const { workbench, scripted, hostEvents } = setupTerminal();
    const capability = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });
    await capability({ operation: "open", request: { cols: 80, rows: 24 } });
    const beforeSubscribe = scripted.handlerCounts();
    await capability({ operation: "subscribe", sessionId: "session-1" });

    expect(scripted.handlerCounts()).toEqual({
      data: beforeSubscribe.data,
      exit: beforeSubscribe.exit + 1,
    });

    hostEvents.unbind();

    expect(scripted.handlerCounts()).toEqual(beforeSubscribe);
  });

  test("operations on unknown sessions reject", async () => {
    const { workbench, hostEvents } = setupTerminal();
    const capability = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });

    await expect(capability({ operation: "write", sessionId: "missing", data: "x" })).rejects.toThrow(/unknown/i);
  });
});

describe("terminal.session capability gate", () => {
  const buildRegistry = (input: ReturnType<typeof setupTerminal>): HostCapabilityRegistry =>
    createWorkbenchWebviewHostCapabilities({ workbench: input.workbench, hostEvents: input.hostEvents });

  test("a webview declaring terminal.session can call the host capability", async () => {
    const setup = setupTerminal();
    const gate = createHostCapabilityGate({
      capabilities: buildRegistry(setup),
      declaredCapabilities: ["terminal.session"],
    });

    await expect(
      gate.call({ method: "terminal.session", params: { operation: "open", request: { cols: 80, rows: 24 } } }),
    ).resolves.toEqual({ operation: "open", sessionId: "session-1" });
  });

  test("a webview omitting terminal.session is rejected", async () => {
    const setup = setupTerminal();
    const gate = createHostCapabilityGate({
      capabilities: buildRegistry(setup),
      declaredCapabilities: ["commands.execute"],
    });

    await expect(
      gate.call({ method: "terminal.session", params: { operation: "open", request: { cols: 80, rows: 24 } } }),
    ).rejects.toThrow(/did not declare/i);
  });

  test("versioned terminal.session declarations are accepted", async () => {
    const setup = setupTerminal();
    const gate = createHostCapabilityGate({
      capabilities: buildRegistry(setup),
      declaredCapabilities: ["terminal.session@1"],
    });

    await expect(
      gate.call({ method: "terminal.session", params: { operation: "open", request: { cols: 80, rows: 24 } } }),
    ).resolves.toEqual({ operation: "open", sessionId: "session-1" });
  });
});
