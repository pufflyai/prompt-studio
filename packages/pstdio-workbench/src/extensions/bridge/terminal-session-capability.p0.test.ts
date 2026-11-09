import { describe, expect, test } from "bun:test";
import { createHostCapabilityGate, type HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher, type HostEventMessage } from "pstdio-extensions/bridge/host";
import { createWorkbench, type WorkbenchTerminalSessionAdapter } from "../../core";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
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
  const workbench = createWorkbench();
  const scripted = createScriptedAdapter("session-1");
  workbench.terminal.setSessionOpener(async () => scripted.adapter);
  const events: HostEventMessage[] = [];
  const hostEvents = createHostEventPublisher();
  hostEvents.bind((message) => events.push(message));
  return { workbench, scripted, hostEvents, events };
};

describe("createTerminalSessionCapability", () => {
  test("a webview cannot control a native terminal or another webview's session", async () => {
    const { workbench, hostEvents, scripted } = setupTerminal();
    const foreign = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });
    const owner = createTerminalSessionCapability({ terminal: workbench.terminal, hostEvents });
    await owner({ operation: "open", request: { cols: 80, rows: 24 } });
    for (const operation of [
      { operation: "write", data: "foreign" },
      { operation: "resize", cols: 1, rows: 1 },
      { operation: "subscribe" },
      { operation: "kill" },
    ]) {
      await expect(foreign({ ...operation, sessionId: "session-1" })).rejects.toThrow(/owner/i);
    }
    expect(scripted.calls).toEqual([]);
    await owner({ operation: "kill", sessionId: "session-1" });
  });
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

test("dashboard capability refresh preserves the same webview's terminal ownership", async () => {
  const { workbench, hostEvents, scripted } = setupTerminal();
  const adapters = { terminal: workbench.terminal, hostEvents };
  const first = createExtensionWebviewHostCapabilities(adapters)["terminal.session"];
  await first({ operation: "open", request: { cols: 80, rows: 24 } });
  const refreshed = createExtensionWebviewHostCapabilities(adapters)["terminal.session"];
  const foreign = createExtensionWebviewHostCapabilities({ ...adapters, hostEvents: createHostEventPublisher() })[
    "terminal.session"
  ];
  try {
    await expect(foreign({ operation: "write", sessionId: "session-1", data: "foreign" })).rejects.toThrow(/owner/i);
    await refreshed({ operation: "write", sessionId: "session-1", data: "retained" });
    expect(scripted.calls).toEqual(["write:retained"]);
    await refreshed({ operation: "kill", sessionId: "session-1" });
  } finally {
    await workbench.dispose();
  }
});

test("a replacement webview guest cannot inherit the prior guest's terminal ownership", async () => {
  const { workbench, hostEvents, scripted, events } = setupTerminal();
  const adapters = { terminal: workbench.terminal, hostEvents };
  const original = createExtensionWebviewHostCapabilities(adapters, "installed-one/project/view/module-one")[
    "terminal.session"
  ];
  await original({ operation: "open", request: { cols: 80, rows: 24 } });
  await original({ operation: "subscribe", sessionId: "session-1" });
  const replacement = createExtensionWebviewHostCapabilities(adapters, "installed-two/project/view/module-two")[
    "terminal.session"
  ];
  try {
    await Promise.resolve();
    expect(scripted.calls).toEqual(["kill:default"]);
    expect(events).toEqual([]);
    scripted.adapter.write("prior guest output");
    expect(events).toEqual([]);
    await expect(original({ operation: "write", sessionId: "session-1", data: "stale" })).rejects.toThrow(/disposed/i);
    await expect(replacement({ operation: "kill", sessionId: "session-1" })).rejects.toThrow(/owner/i);
  } finally {
    await workbench.dispose();
  }
});

test("the public Workbench capability helper scopes ownership to its logical guest", async () => {
  const { workbench, hostEvents } = setupTerminal();
  const input = { workbench, hostEvents, projectId: "project", extensionId: "example.owner", webviewId: "first" };
  const first = createWorkbenchWebviewHostCapabilities(input)["terminal.session"];
  await first({ operation: "open", request: { cols: 80, rows: 24 } });
  const refreshed = createWorkbenchWebviewHostCapabilities(input)["terminal.session"];
  await refreshed({ operation: "write", sessionId: "session-1", data: "retained" });
  const replacement = createWorkbenchWebviewHostCapabilities({ ...input, webviewId: "second" })["terminal.session"];
  try {
    await expect(replacement({ operation: "kill", sessionId: "session-1" })).rejects.toThrow(/owner/i);
  } finally {
    await workbench.dispose();
  }
});

test("replacing a guest cancels its pending terminal admission and kills a late adapter", async () => {
  const { workbench, hostEvents, scripted } = setupTerminal();
  const pending = Promise.withResolvers<WorkbenchTerminalSessionAdapter>();
  let admissionSignal: AbortSignal | undefined;
  workbench.terminal.setSessionOpener((_request, _view, signal) => {
    admissionSignal = signal;
    return pending.promise;
  });
  const adapters = { terminal: workbench.terminal, hostEvents };
  const original = createExtensionWebviewHostCapabilities(adapters, "original")["terminal.session"];
  const opening = original({ operation: "open", request: { cols: 80, rows: 24 } });
  const rejected = Promise.resolve(opening).catch((error) => error);
  createExtensionWebviewHostCapabilities(adapters, "replacement");
  try {
    expect(admissionSignal?.aborted).toBe(true);
    pending.resolve(scripted.adapter);
    expect(await rejected).toBeInstanceOf(Error);
    expect(scripted.calls).toEqual(["kill:default"]);
    expect(workbench.terminal.listSessions()).toEqual([]);
  } finally {
    await workbench.dispose();
  }
});

test("removing terminal support releases the previous guest's sessions and subscriptions", async () => {
  const { workbench, hostEvents, scripted, events } = setupTerminal();
  const original = createExtensionWebviewHostCapabilities({ terminal: workbench.terminal, hostEvents }, "original")[
    "terminal.session"
  ];
  await original({ operation: "open", request: { cols: 80, rows: 24 } });
  await original({ operation: "subscribe", sessionId: "session-1" });
  try {
    createExtensionWebviewHostCapabilities({ hostEvents }, "replacement");
    await Promise.resolve();
    expect(scripted.calls).toEqual(["kill:default"]);
    expect(events).toEqual([]);
  } finally {
    await workbench.dispose();
  }
});

test.each([
  "closure",
  "declaration removal",
] as const)("permanent webview %s releases ownership while frame reconnects preserve it", async (removal) => {
  const { getBridgeWebviewHostEventPublisher, reconcileBridgeWebviewHostEventPublishers } = await import(
    "./bridge-webview-renderer"
  );
  const { workbench, scripted } = setupTerminal();
  workbench.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  workbench.pageLocations.setProject("project");
  workbench.views.registerView({ id: "guest", title: "Guest", body: { kind: "react", render: () => null } });
  workbench.shellPlacements.registerPlacement({
    id: "guest-placement",
    item: { kind: "view", view: { kind: "view", id: "guest" }, presence: "closed" },
    region: "secondary",
  });
  const identity = workbench.shellPlacements.openPlacement({ placementId: "guest-placement", region: "secondary" });
  const instance = workbench.layout.listPanelInstances().find((panel) => panel.viewId === "guest")!;
  const hostEvents = getBridgeWebviewHostEventPublisher(workbench, instance);
  const capability = createExtensionWebviewHostCapabilities({ terminal: workbench.terminal, hostEvents }, "guest")[
    "terminal.session"
  ];
  await capability({ operation: "open", request: { cols: 80, rows: 24 } });
  try {
    hostEvents.unbind();
    hostEvents.bind(() => {});
    expect(scripted.calls).toEqual([]);
    if (removal === "closure") workbench.closePlacement(identity);
    else {
      reconcileBridgeWebviewHostEventPublishers(workbench, "project", new Set(["guest"]));
      expect(scripted.calls).toEqual([]);
      reconcileBridgeWebviewHostEventPublishers(workbench, "project", new Set());
      expect(workbench.layout.listPanelInstances().some((panel) => panel.instanceId === instance.instanceId)).toBe(
        true,
      );
    }
    await Bun.sleep(0);
    expect(scripted.calls).toEqual(["kill:default"]);
    await expect(capability({ operation: "write", sessionId: "session-1", data: "stale" })).rejects.toThrow(/disposed/);
  } finally {
    await workbench.dispose();
  }
});

test("reused webview placement identities have separate project owners", async () => {
  const { getBridgeWebviewHostEventPublisher } = await import("./bridge-webview-renderer");
  const workbench = createWorkbench();
  let opens = 0;
  const kills: string[] = [];
  workbench.terminal.setSessionOpener(async () => {
    const id = `session-${++opens}`;
    return {
      id,
      write() {},
      resize() {},
      kill() {
        kills.push(id);
      },
      onData: () => () => {},
      onExit: () => () => {},
      onError: () => () => {},
    };
  });
  workbench.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  workbench.views.registerView({ id: "guest", title: "Guest", body: { kind: "react", render: () => null } });
  workbench.shellPlacements.registerPlacement({
    id: "shared-guest",
    item: { kind: "view", view: { kind: "view", id: "guest" }, presence: "closed" },
    region: "secondary",
  });
  const open = async (projectId: string) => {
    workbench.pageLocations.setProject(projectId);
    workbench.layout.setPersistenceScope(projectId);
    const identity = workbench.shellPlacements.openPlacement({ placementId: "shared-guest", region: "secondary" });
    const instance = workbench.layout.listPanelInstances().find((panel) => panel.viewId === "guest")!;
    const events = getBridgeWebviewHostEventPublisher(workbench, instance, projectId);
    const capability = createExtensionWebviewHostCapabilities(
      { terminal: workbench.terminal, hostEvents: events },
      projectId,
    )["terminal.session"];
    await capability({ operation: "open", request: { cols: 80, rows: 24 } });
    return { identity, events, instance, capability };
  };
  try {
    const a = await open("a");
    const b = await open("b");
    expect(a.instance.instanceId).toBe(b.instance.instanceId);
    expect(a.events).not.toBe(b.events);
    workbench.closePlacement(b.identity);
    await Bun.sleep(0);
    expect(kills).toEqual(["session-2"]);
    await a.capability({ operation: "write", sessionId: "session-1", data: "retained" });
  } finally {
    await workbench.dispose();
  }
});
