import { expect, test } from "bun:test";
import {
  createScopedQueryClient,
  createWebviewClient,
  type GuestHost,
  type ScopedQueryClient,
} from "@pstdio/sdk/extensions";
import type { WebviewEditingSource } from "pstdio-api-contracts/extension-kernel";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { createWebviewKeyboardShortcuts } from "../../react/keybindings/webview-keyboard-shortcuts";
import { inspectCommandEditingSessions } from "./command-editing-sessions";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const editor = (provided?: ScopedQueryClient, typedEvents = false) => {
  const queries = provided ?? createScopedQueryClient({ runtimeId: "command-editor", extensionId: "example.editor" });
  const core = createWorkbench({ queries });
  core.pageLocations.setProject("project");
  let value = { title: "Before", tool: "move" };
  let reads = 0;
  let presentationReads = 0;
  let invalidAcknowledgement = false;
  let failure: Error | undefined;
  let presentationFailure: Error | undefined;
  const actions: unknown[] = [];
  const hold = Promise.withResolvers<void>();
  let holding = false;
  let heldRead:
    | {
        started: ReturnType<typeof Promise.withResolvers<void>>;
        release: ReturnType<typeof Promise.withResolvers<void>>;
      }
    | undefined;
  const sources: WebviewEditingSource[] = [
    {
      id: "document",
      read: { commandId: "example.editor.command.read" },
      dependsOn: ["document.changed"],
      dependency: { recordId: "document" },
    },
    {
      id: "presentation",
      read: { commandId: "example.editor.command.presentation" },
      dependsOn: typedEvents ? [{ kind: "event", id: "presentation.changed" }] : ["presentation.changed"],
      dependency: { recordId: "presentation" },
    },
  ];
  core.commands.registerCommand(
    { id: "example.editor.command.read", label: "Read" },
    {
      execute: async () => {
        reads++;
        const result = { value: structuredClone(value), sources };
        const held = heldRead;
        heldRead = undefined;
        if (held) {
          held.started.resolve();
          await held.release.promise;
        }
        return result;
      },
    },
  );
  core.commands.registerCommand(
    { id: "example.editor.command.presentation", label: "Read presentation" },
    {
      execute: async () => {
        presentationReads++;
        if (presentationFailure) {
          const error = presentationFailure;
          presentationFailure = undefined;
          throw error;
        }
        return { changes: [{ path: ["tool"], value: value.tool }] };
      },
    },
  );
  core.commands.registerCommand(
    { id: "example.editor.command.edit", label: "Edit" },
    {
      execute: async (params) => {
        actions.push(params);
        if (holding) await hold.promise;
        if (failure) {
          const error = failure;
          failure = undefined;
          throw error;
        }
        const input = params as { title?: string; tool?: string };
        value = { ...value, ...(input.title && { title: input.title }), ...(input.tool && { tool: input.tool }) };
        if (invalidAcknowledgement) {
          invalidAcknowledgement = false;
          return { changes: [{ path: [], value: 7 }] };
        }
        return input.tool
          ? { changes: [{ path: ["tool"], value: value.tool }], sourceIds: ["presentation"] }
          : { value: structuredClone(value), sourceIds: ["document", "presentation"] };
      },
    },
  );
  const frame = (id: string) => {
    const events: unknown[] = [];
    const hostEvents = createHostEventPublisher();
    const listeners = new Map<string, Set<(payload: unknown) => void>>();
    hostEvents.bind((event) => {
      events.push(event.payload);
      for (const listener of listeners.get(event.scope) ?? []) listener(event.payload);
    });
    const gate = createHostCapabilityGate({
      capabilities: createWorkbenchWebviewHostCapabilities({
        workbench: core,
        projectId: "project",
        extensionId: "example.editor",
        hostEvents,
      }),
      declaredCapabilities: ["editing.session"],
    });
    const call = (input: object) => gate.call({ method: "editing.session", params: { sessionId: id, ...input } });
    return {
      call,
      events,
      host: {
        extensionId: "example.editor",
        call: async <Result>(method: string, params?: unknown) => (await gate.call({ method, params })) as Result,
        onEvent(scope: string, handler: (payload: unknown) => void) {
          const handlers = listeners.get(scope) ?? new Set();
          listeners.set(scope, handlers);
          handlers.add(handler);
          return () => {
            handlers.delete(handler);
          };
        },
      } satisfies GuestHost,
      open: (overrides: object = {}) =>
        call({
          operation: "open-command",
          key: "document",
          read: { commandId: "example.editor.command.read" },
          command: { commandId: "example.editor.command.edit" },
          dependsOn: ["document.changed", "presentation.changed"],
          ...overrides,
        }),
      close: () => call({ operation: "close" }),
    };
  };
  return {
    frame,
    queries,
    core,
    actions,
    fail: (error: Error) => {
      failure = error;
    },
    invalidAck: () => {
      invalidAcknowledgement = true;
    },
    failPresentation: (error: Error) => {
      presentationFailure = error;
    },
    presentationReads: () => presentationReads,
    reads: () => reads,
    holdRead: () => {
      const held = { started: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() };
      heldRead = held;
      return held;
    },
    setTitle: (title: string) => {
      value = { ...value, title };
    },
    setTool: (tool: string) => {
      value = { ...value, tool };
    },
    hold: () => {
      holding = true;
    },
    release: () => hold.resolve(),
    dispose: async () => {
      hold.resolve();
      await core.dispose();
      if (!provided) queries.dispose();
    },
  };
};

test.each([
  "complete",
  "replace",
  "switch",
] as const)("a direct editing shortcut preserves admitted ordering and invalidates stale invocation: %s", async (continuation) => {
  const fixture = editor();
  const frame = fixture.frame("property");
  let saving = Promise.resolve<unknown>(undefined);
  let action = Promise.resolve();
  try {
    await frame.open();
    fixture.hold();
    saving = frame.call({
      operation: "execute",
      sequence: 1,
      params: { title: "Defocused property" },
      changes: [{ path: ["title"], value: "Defocused property" }],
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const binding = fixture.core.keybindings.registerKeybinding({
      id: "editing-action",
      keybinding: "Mod+Z",
      action: { kind: "command", commandId: "example.editor.command.edit", args: { title: "Later action" } },
    });
    const bridge = createWebviewKeyboardShortcuts(fixture.core, ["example.editor.command.edit"]);
    action = bridge.dispatch({ id: bridge.shortcuts[0]!.id, repeat: false });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fixture.actions).toHaveLength(1);
    if (continuation === "replace") {
      binding.dispose();
      fixture.core.keybindings.registerKeybinding({
        id: "editing-action",
        keybinding: "Mod+Y",
        action: { kind: "command", commandId: "example.editor.command.edit", args: { title: "Replacement" } },
      });
    }
    if (continuation === "switch") fixture.core.pageLocations.setProject("another-project");
    fixture.release();
    await Promise.all([saving, action]);
    expect(fixture.actions).toHaveLength(continuation === "complete" ? 2 : 1);
    if (continuation === "complete") expect(fixture.actions[1]).toMatchObject({ title: "Later action" });
  } finally {
    fixture.release();
    await Promise.allSettled([saving, action]);
    await fixture.dispose();
  }
});

test("five command editing views join one authoritative load and share warm accepted presentation values", async () => {
  const fixture = editor();
  const frames = Array.from({ length: 5 }, (_, index) => fixture.frame(String(index)));
  try {
    const snapshots = await Promise.all(frames.map((frame) => frame.open()));
    expect(snapshots).toEqual(
      snapshots.map(() => expect.objectContaining({ value: { title: "Before", tool: "move" } })),
    );
    expect(fixture.reads()).toBe(1);
    await frames[0].call({
      operation: "execute",
      sequence: 1,
      params: { tool: "hand" },
      channel: "presentation",
      changes: [{ path: ["tool"], value: "hand" }],
    });
    expect(fixture.reads()).toBe(1);
    for (const frame of frames)
      expect(frame.events.at(-1)).toMatchObject({ snapshot: { value: { title: "Before", tool: "hand" } } });
    await Promise.all(frames.map((frame) => frame.close()));
    expect(await fixture.frame("returning").open()).toMatchObject({ value: { title: "Before", tool: "hand" } });
    expect(fixture.reads()).toBe(1);
  } finally {
    await fixture.dispose();
  }
});

test("command previews cancel without persistence and completed gestures keep separate ordered commands", async () => {
  const fixture = editor();
  const first = fixture.frame("first");
  const peer = fixture.frame("peer");
  try {
    await Promise.all([first.open(), peer.open()]);
    await first.call({ operation: "preview", sequence: 1, changes: [{ path: ["title"], value: "Preview" }] });
    expect(peer.events.at(-1)).toMatchObject({ snapshot: { value: { title: "Preview" }, hasDrafts: true } });
    await first.call({ operation: "cancel" });
    expect(fixture.actions).toEqual([]);
    expect(peer.events.at(-1)).toMatchObject({ snapshot: { value: { title: "Before" }, hasDrafts: false } });
    fixture.hold();
    const a = first.call({
      operation: "execute",
      sequence: 2,
      params: { title: "A" },
      changes: [{ path: ["title"], value: "A" }],
    });
    const b = peer.call({
      operation: "execute",
      sequence: 1,
      params: { title: "B" },
      changes: [{ path: ["title"], value: "B" }],
    });
    await Bun.sleep(0);
    expect(peer.events.at(-1)).toMatchObject({ snapshot: { value: { title: "B" }, revision: 2, savedRevision: 0 } });
    expect(fixture.actions).toHaveLength(1);
    fixture.release();
    await Promise.all([a, b]);
    expect(fixture.actions).toHaveLength(2);
    expect(peer.events.at(-1)).toMatchObject({ snapshot: { value: { title: "B" }, revision: 2, savedRevision: 2 } });
  } finally {
    await fixture.dispose();
  }
});

test("failed command acknowledgements retain optimism and retry the same operation identity", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    fixture.fail(new Error("Offline"));
    await expect(
      frame.call({
        operation: "execute",
        sequence: 1,
        params: { tool: "hand" },
        channel: "presentation",
        changes: [{ path: ["tool"], value: "hand" }],
      }),
    ).rejects.toThrow("Offline");
    expect(frame.events.at(-1)).toMatchObject({
      snapshot: {
        value: { tool: "hand" },
        savedRevision: 0,
        revision: 1,
        pendingCommands: 1,
        error: { message: "Offline", channel: "presentation" },
      },
    });
    await frame.call({ operation: "save" });
    expect(fixture.actions).toHaveLength(2);
    expect(fixture.actions[0]).toEqual(fixture.actions[1]);
    expect(fixture.actions[0]).toMatchObject({ operationId: expect.any(String) });
    expect(frame.events.at(-1)).toMatchObject({
      snapshot: { value: { tool: "hand" }, savedRevision: 1, pendingCommands: 0 },
    });
    expect(frame.events.at(-1)).not.toHaveProperty("snapshot.error");
  } finally {
    await fixture.dispose();
  }
});

test("warm command sessions incorporate scoped shared presentation changes without reading the full document", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    fixture.core.activation.setActive(false);
    fixture.setTool("hand");
    fixture.queries.invalidate({
      type: "reset",
      projectId: "project",
      extensionId: "example.editor",
      recordIds: ["presentation"],
    });
    await Bun.sleep(0);
    expect(fixture.presentationReads()).toBe(0);
    expect(fixture.reads()).toBe(1);
    fixture.core.activation.setActive(true);
    await Bun.sleep(0);
    expect(fixture.presentationReads()).toBe(1);
    expect(fixture.reads()).toBe(1);
    expect(frame.events.at(-1)).toMatchObject({ snapshot: { value: { tool: "hand" } } });
    await frame.close();
    fixture.setTool("move");
    fixture.queries.invalidate({
      type: "changed",
      id: "presentation.changed",
      projectId: "project",
      recordIds: ["presentation"],
    });
    await Bun.sleep(0);
    expect(fixture.presentationReads()).toBe(1);
    const returning = fixture.frame("return");
    expect(await returning.open()).toMatchObject({ value: { tool: "hand" } });
    await Bun.sleep(0);
    expect(returning.events.at(-1)).toMatchObject({ snapshot: { value: { tool: "move" } } });
    expect(fixture.presentationReads()).toBe(2);
    expect(fixture.reads()).toBe(1);
  } finally {
    await fixture.dispose();
  }
});

test("retiring query authority clears private editing projections before allowing another identity", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    fixture.queries.setAuthority({ accountId: "another" });
    expect((frame.events.at(-1) as { snapshot: { value: unknown } }).snapshot.value).toEqual({});
    await expect(frame.call({ operation: "save" })).rejects.toThrow("editing_session_closed");
    fixture.setTool("hand");
    expect(await fixture.frame("new-account").open()).toMatchObject({ value: { tool: "hand" } });
    expect(fixture.reads()).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("core retirement waits for accepted command persistence and prevents late private publication", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    fixture.hold();
    const saving = frame.call({
      operation: "execute",
      sequence: 1,
      params: { title: "Accepted" },
      changes: [{ path: ["title"], value: "Accepted" }],
    });
    await Bun.sleep(0);
    let disposed = false;
    const disposing = fixture.core.dispose().then(() => {
      disposed = true;
    });
    await Bun.sleep(0);
    expect(disposed).toBe(false);
    expect((frame.events.at(-1) as { snapshot: { value: unknown } }).snapshot.value).toEqual({});
    fixture.release();
    await Promise.all([saving, disposing]);
    expect((frame.events.at(-1) as { snapshot: { value: unknown } }).snapshot.value).toEqual({});
  } finally {
    await fixture.dispose();
  }
});

test("workbenches sharing a runtime share command authority and retirement releases only the closing core", async () => {
  const queries = createScopedQueryClient({ runtimeId: "shared-editing", extensionId: "example.editor" });
  const first = editor(queries);
  const second = editor(queries);
  const a = first.frame("a");
  const b = second.frame("b");
  try {
    await Promise.all([a.open(), b.open()]);
    expect(first.reads() + second.reads()).toBe(1);
    await a.call({ operation: "preview", sequence: 1, changes: [{ path: ["title"], value: "Shared preview" }] });
    expect(b.events.at(-1)).toMatchObject({ snapshot: { value: { title: "Shared preview" } } });
    await first.core.dispose();
    expect(await b.call({ operation: "save" })).toMatchObject({ value: { title: "Before" } });
    await b.call({
      operation: "execute",
      sequence: 1,
      params: { tool: "hand" },
      changes: [{ path: ["tool"], value: "hand" }],
    });
    expect(second.actions).toHaveLength(1);
    expect(first.reads() + second.reads()).toBe(1);
  } finally {
    await first.dispose();
    await second.dispose();
    queries.dispose();
  }
});

test("SDK retirement clears private optimism before a held outgoing bridge request is dispatched", async () => {
  const fixture = editor();
  const frame = fixture.frame("sdk");
  const hold = Promise.withResolvers<void>();
  const host: GuestHost = {
    ...frame.host,
    call: async <Result>(method: string, params?: unknown) => {
      if ((params as { operation?: string })?.operation === "execute") await hold.promise;
      return frame.host.call<Result>(method, params);
    },
  };
  try {
    const session = await createWebviewClient(host).editing.openCommand<{ title: string }>({
      key: "document",
      read: { commandId: "example.editor.command.read" },
      command: { commandId: "example.editor.command.edit" },
      dependsOn: ["document.changed", "presentation.changed"],
    });
    const saving = session
      .execute({ title: "Private" }, { changes: [{ path: ["title"], value: "Private" }] })
      .catch((error: unknown) => error);
    fixture.queries.setAuthority({ accountId: "another" });
    expect(Object.keys(session.getSnapshot().value)).toEqual([]);
    await expect(session.preview([{ path: ["title"], value: "Late private edit" }])).rejects.toThrow(
      "editing_session_closed",
    );
    hold.resolve();
    await saving;
    expect(Object.keys(session.getSnapshot().value)).toEqual([]);
    expect(fixture.actions).toEqual([]);
  } finally {
    hold.resolve();
    await fixture.dispose();
  }
});

test("a shared change during initial-load handoff cannot seed fresh sources with an older value", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  let changed = false;
  const stop = frame.host.onEvent("editing.session", (payload) => {
    if (changed || (payload as { snapshot: { value: { tool?: string } } }).snapshot.value.tool !== "move") return;
    changed = true;
    fixture.setTool("hand");
    fixture.queries.invalidate({
      type: "changed",
      id: "presentation.changed",
      projectId: "project",
      recordIds: ["presentation"],
    });
  });
  try {
    const result = await frame.open();
    expect(changed).toBe(true);
    expect(result).toMatchObject({ value: { tool: "hand" } });
  } finally {
    stop();
    await fixture.dispose();
  }
});

test("retiring one core drains its captured commands without waiting for a peer's later command", async () => {
  const queries = createScopedQueryClient({ runtimeId: "shared-drain", extensionId: "example.editor" });
  const first = editor(queries);
  const second = editor(queries);
  const a = first.frame("a");
  const b = second.frame("b");
  const pending: Promise<unknown>[] = [];
  try {
    await Promise.all([a.open(), b.open()]);
    first.hold();
    second.hold();
    pending.push(a.call({ operation: "execute", sequence: 1, params: { title: "A" }, changes: [] }));
    pending.push(b.call({ operation: "execute", sequence: 1, params: { title: "B" }, changes: [] }));
    await Bun.sleep(0);
    let retired = false;
    pending.push(
      first.core.dispose().then(() => {
        retired = true;
      }),
    );
    first.release();
    await Bun.sleep(0);
    expect(second.actions).toHaveLength(1);
    expect(retired).toBe(true);
  } finally {
    first.release();
    second.release();
    await Promise.allSettled(pending);
    await first.dispose();
    await second.dispose();
    queries.dispose();
  }
});

test("scoped read failures remain visible with accepted data and save explicitly retries the failed source", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    fixture.failPresentation(new Error("Presentation read failed"));
    fixture.queries.invalidate({
      type: "changed",
      id: "presentation.changed",
      projectId: "project",
      recordIds: ["presentation"],
    });
    await Bun.sleep(0);
    expect(frame.events.at(-1)).toMatchObject({
      snapshot: { value: { tool: "move" }, error: { message: "Presentation read failed", sourceId: "presentation" } },
    });
    fixture.setTool("hand");
    const result = await frame.call({ operation: "save" });
    expect(result).toMatchObject({ value: { tool: "hand" } });
    expect(result).not.toHaveProperty("error");
    expect(fixture.presentationReads()).toBe(2);
    expect(fixture.reads()).toBe(1);
  } finally {
    await fixture.dispose();
  }
});

test("inactive editors release revoked private owners without reopening or optional background reads", async () => {
  const fixture = editor();
  try {
    for (let index = 0; index < 3; index++) {
      const frame = fixture.frame(String(index));
      await frame.open();
      await frame.close();
      const reads = fixture.reads();
      fixture.queries.setAuthority({ accountId: String(index) });
      await Bun.sleep(0);
      expect(fixture.reads()).toBe(reads);
      expect(inspectCommandEditingSessions(fixture.queries)).toEqual({ retained: 0, owners: 0 });
    }
  } finally {
    await fixture.dispose();
  }
});

test("active command sources survive a zero inactive-query budget during initial-load handoff", async () => {
  const queries = createScopedQueryClient(
    { runtimeId: "bounded-editing", extensionId: "example.editor" },
    { maxInactive: 0 },
  );
  const fixture = editor(queries);
  try {
    const frames = Array.from({ length: 5 }, (_, index) => fixture.frame(String(index)));
    const snapshots = await Promise.all(frames.map((frame) => frame.open()));
    for (const snapshot of snapshots) expect(snapshot).toMatchObject({ value: { tool: "move" } });
    expect(fixture.reads()).toBe(1);
  } finally {
    await fixture.dispose();
    queries.dispose();
  }
});

test("retiring a clean peer does not retry another core's failed accepted command", async () => {
  const queries = createScopedQueryClient({ runtimeId: "shared-failure", extensionId: "example.editor" });
  const first = editor(queries);
  const second = editor(queries);
  const a = first.frame("a");
  const b = second.frame("b");
  try {
    await Promise.all([a.open(), b.open()]);
    second.fail(new Error("Offline"));
    await expect(b.call({ operation: "execute", sequence: 1, params: { tool: "hand" }, changes: [] })).rejects.toThrow(
      "Offline",
    );
    expect(second.actions).toHaveLength(1);
    await first.core.dispose();
    expect(second.actions).toHaveLength(1);
    await b.call({ operation: "save" });
    expect(second.actions).toHaveLength(2);
  } finally {
    await first.dispose();
    await second.dispose();
    queries.dispose();
  }
});

test("command session sources resolve typed event ownership through the public editing boundary", async () => {
  const fixture = editor(undefined, true);
  const frame = fixture.frame("frame");
  try {
    await frame.open({ dependsOn: [{ kind: "event", id: "presentation.changed" }] });
    fixture.setTool("hand");
    fixture.queries.invalidate({
      type: "changed",
      id: "example.editor.event.presentation.changed",
      projectId: "project",
      recordIds: ["presentation"],
    });
    await Bun.sleep(0);
    expect(frame.events.at(-1)).toMatchObject({ snapshot: { value: { tool: "hand" } } });
    expect(fixture.presentationReads()).toBe(1);
    expect(fixture.reads()).toBe(1);
  } finally {
    await fixture.dispose();
  }
});

test("a failing retirement observer cannot prevent later private editing owners from being purged", async () => {
  const fixture = editor();
  let stop = () => {};
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    await frame.close();
    stop = fixture.queries.subscribeRetirement(() => {
      throw new Error("Observer failed");
    });
    expect(() => fixture.queries.setAuthority({ accountId: "another" })).toThrow("Observer failed");
    await Bun.sleep(0);
    expect(inspectCommandEditingSessions(fixture.queries)).toEqual({ retained: 0, owners: 0 });
  } finally {
    stop();
    await fixture.dispose();
  }
});

test("an inapplicable authoritative acknowledgement retains its required command and pending optimism", async () => {
  const fixture = editor();
  const frame = fixture.frame("frame");
  try {
    await frame.open();
    fixture.invalidAck();
    await expect(
      frame.call({
        operation: "execute",
        sequence: 1,
        params: { tool: "hand" },
        changes: [{ path: ["tool"], value: "hand" }],
      }),
    ).rejects.toThrow("root must be an object");
    expect(frame.events.at(-1)).toMatchObject({
      snapshot: {
        value: { tool: "hand" },
        revision: 1,
        savedRevision: 0,
        pendingCommands: 1,
        error: { message: "The editing state root must be an object" },
      },
    });
    expect(await frame.call({ operation: "save" })).toMatchObject({
      value: { tool: "hand" },
      savedRevision: 1,
      pendingCommands: 0,
    });
    expect(fixture.actions).toHaveLength(2);
    expect(fixture.actions[0]).toEqual(fixture.actions[1]);
  } finally {
    await fixture.dispose();
  }
});

test("a full source result cannot silently cover another source's newer invalidation", async () => {
  const fixture = editor();
  const frame = fixture.frame("member");
  const held = fixture.holdRead();
  held.release.resolve(); // The bootstrap is not the read being qualified.
  try {
    await frame.open();
    fixture.setTitle("New document");
    const reading = fixture.holdRead();
    fixture.queries.invalidate({
      type: "reset",
      projectId: "project",
      extensionId: "example.editor",
      recordIds: ["document"],
    });
    await reading.started.promise;
    fixture.setTool("hand");
    fixture.queries.invalidate({
      type: "reset",
      projectId: "project",
      extensionId: "example.editor",
      recordIds: ["presentation"],
    });
    reading.release.resolve();
    await Bun.sleep(0);
    expect(frame.events.at(-1)).toMatchObject({ snapshot: { value: { title: "New document", tool: "hand" } } });
    expect(fixture.presentationReads()).toBe(1);
  } finally {
    held.release.resolve();
    await fixture.dispose();
  }
});
