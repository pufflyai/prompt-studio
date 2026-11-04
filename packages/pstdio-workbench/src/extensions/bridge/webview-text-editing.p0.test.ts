import { afterEach, expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import type { PageParams } from "@pstdio/sdk/extensions";
import type { TextEditingEvent, TextEditingOpened, TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { harness, navigate, openFile } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const fixtures: (() => Promise<void>)[] = [];
const activityGate = () => ({ entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>() });
afterEach(async () => {
  for (const stop of fixtures.splice(0)) await stop();
});
const textEventStream = () => {
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const ready = Promise.withResolvers<void>();
  const encoder = new TextEncoder();
  return {
    ready: ready.promise,
    response() {
      let current: ReadableStreamDefaultController<Uint8Array>;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            current = controller;
            streams.add(controller);
            controller.enqueue(encoder.encode(": ready\n\n"));
            ready.resolve();
          },
          cancel() {
            streams.delete(current);
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      );
    },
    emit(event: TextEditingEvent) {
      for (const controller of streams)
        controller.enqueue(encoder.encode(`event: text\ndata: ${JSON.stringify(event)}\n\n`));
    },
  };
};
const openingReplies = () => {
  let count = 0;
  let next: ReturnType<typeof activityGate> | undefined;
  let abandon: ReturnType<typeof activityGate> | undefined;
  const handles = new Map<string, string>();
  const gates = new Set<ReturnType<typeof activityGate>>();
  return {
    hold() {
      next = activityGate();
      gates.add(next);
      return { ...next, handle: `handle-${count + 1}` };
    },
    holdAbandon() {
      abandon = activityGate();
      gates.add(abandon);
      return abandon;
    },
    close(handle: string) {
      for (const [id, current] of handles) if (current === handle) handles.delete(id);
    },
    async abandon(id: string) {
      handles.delete(id);
      const held = abandon;
      abandon = undefined;
      if (held) {
        held.entered.resolve();
        await held.release.promise;
        gates.delete(held);
      }
    },
    async open(memberId: string) {
      const handle = handles.get(memberId) ?? `handle-${++count}`;
      handles.set(memberId, handle);
      const held = next;
      next = undefined;
      if (held) {
        held.entered.resolve();
        await held.release.promise;
        gates.delete(held);
      }
      return { handle, grant: { token: "selected" }, sourceIdentity: "source" };
    },
    dispose() {
      for (const gate of gates) gate.release.resolve();
      gates.clear();
    },
  };
};

// The remote is controlled; transport, guest multiplexing, capability gate and Workbench are real.
const fixture = async () => {
  const scopes: unknown[] = [];
  const disconnected: string[] = [];
  const active: boolean[] = [];
  const activeObservers = new Set<() => void>();
  const activityGates = new Map<boolean, ReturnType<typeof activityGate>>();
  let guests = 0;
  const openings = openingReplies();
  const requests: string[] = [];
  const connectionStarted = Promise.withResolvers<void>();
  const closeStarted = Promise.withResolvers<void>();
  const stream = textEventStream();
  const releaseConnection = Promise.withResolvers<void>();
  const releaseClose = Promise.withResolvers<void>();
  let holdConnection = false;
  let refuseConnection = false;
  let holdClose = false;
  let refuseDisconnect = false;
  let refuseOpen = false;
  const reply = (value?: unknown) => Response.json({ ok: true, value });
  const connect = async (input: unknown) => {
    scopes.push(input);
    if (refuseConnection) {
      refuseConnection = false;
      return Response.json({
        ok: false,
        error: { code: "source_unavailable", message: "Opening interrupted", retryable: true },
      });
    }
    const token = `connection-${scopes.length}`;
    connectionStarted.resolve();
    if (holdConnection) await releaseConnection.promise;
    return reply({ token });
  };
  const disconnect = (token: string) => {
    disconnected.push(token);
    if (refuseDisconnect) {
      refuseDisconnect = false;
      return Response.json({
        ok: false,
        error: { code: "source_unavailable", message: "Cleanup interrupted", retryable: true },
      });
    }
    return reply();
  };
  const applyParticipation = async (next: boolean) => {
    const held = activityGates.get(next);
    if (held) {
      held.entered.resolve();
      await held.release.promise;
      if (activityGates.get(next) === held) activityGates.delete(next);
    }
    active.push(next);
    for (const listener of activeObservers) listener();
    return reply();
  };
  const applyRequest = async (input: TextEditingRequest) => {
    requests.push(input.operation);
    if (input.operation === "open") {
      if (refuseOpen) {
        refuseOpen = false;
        return Response.json({
          ok: false,
          error: { code: "source_read_only", message: "Read only", retryable: false },
        });
      }
      return reply(await openings.open(input.memberId));
    }
    if (input.operation === "close") openings.close(input.handle);
    if (input.operation === "abandon") await openings.abandon(input.memberId);
    return reply({ token: "selected" });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const input = (await request.json()) as {
        token?: string;
        active?: boolean;
        request?: TextEditingRequest;
      };
      if (path.endsWith("/text-editing")) return connect(input);
      if (path.endsWith("/active")) return applyParticipation(input.active!);
      if (path.endsWith("/request")) return applyRequest(input.request!);
      if (path.endsWith("/prepare-close")) {
        closeStarted.resolve();
        if (holdClose) await releaseClose.promise;
        return reply();
      }
      if (path.endsWith("/disconnect")) return disconnect(input.token!);
      if (path.endsWith("/stream")) return stream.response();
      return new Response(null, { status: 404 });
    },
  });
  const workbench = harness();
  workbench.navigation.openTarget(navigate("workspace"));
  workbench.navigation.openTarget(openFile("document"));
  const placement = workbench.layout.getActivePanel("main")!;
  const events = createHostEventPublisher();
  const delivered: unknown[] = [];
  events.bind((event) => delivered.push(event));
  const clientTransport = createClient({ baseUrl: server.url.href }).textEditing;
  const transport = {
    async connect(input: Parameters<typeof clientTransport.connect>[0]) {
      const connection = await clientTransport.connect(input);
      return {
        ...connection,
        guest() {
          guests++;
          return connection.guest();
        },
      };
    },
  };
  const target = { fileRendererId: "paper.public-text-source.view.selected", resource: placement.resource };
  const frame = (
    currentPlacement = placement,
    viewId = "ink.public-text-editor.view.editor",
    publisher = events,
    pageParams?: PageParams,
  ) => {
    const capabilities = createWorkbenchWebviewHostCapabilities({
      workbench,
      placement: currentPlacement,
      projectId: "project",
      extensionId: "ink.public-text-editor",
      webviewId: viewId,
      textTarget: { ...target, resource: currentPlacement.resource, pageParams },
      textEditing: transport,
      hostEvents: publisher,
    });
    const gate = createHostCapabilityGate({ capabilities, declaredCapabilities: ["editing.text"] });
    return (request: TextEditingRequest = { operation: "current" }) =>
      gate.call({ method: "editing.text", params: request });
  };
  const value = {
    workbench,
    placement,
    events,
    delivered,
    target,
    scopes,
    active,
    guests: () => guests,
    holdActivity(active: boolean) {
      const held = activityGate();
      activityGates.set(active, held);
      return held;
    },
    holdNextOpen: openings.hold,
    holdNextAbandon: openings.holdAbandon,
    refuseNextOpen() {
      refuseOpen = true;
    },
    waitActive(next: boolean) {
      if (active.at(-1) === next) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const observe = () => {
          if (active.at(-1) !== next) return;
          activeObservers.delete(observe);
          resolve();
        };
        activeObservers.add(observe);
      });
    },
    disconnected,
    requests,
    connectionStarted: connectionStarted.promise,
    closeStarted: closeStarted.promise,
    streamReady: stream.ready,
    frame,
    holdConnection() {
      holdConnection = true;
    },
    refuseConnection() {
      refuseConnection = true;
    },
    holdClose() {
      holdClose = true;
    },
    refuseDisconnect() {
      refuseDisconnect = true;
    },
    resumeConnection() {
      holdConnection = false;
      releaseConnection.resolve();
    },
    resumeClose() {
      holdClose = false;
      releaseClose.resolve();
    },
    emit: stream.emit,
    async stop() {
      openings.dispose();
      for (const held of activityGates.values()) held.release.resolve();
      releaseConnection.resolve();
      releaseClose.resolve();
      events.unbind();
      await workbench.dispose();
      await server.stop(true);
    },
  };
  fixtures.push(value.stop);
  return value;
};

test("resource removal waits for an installed editor's public close barrier", async () => {
  const f = await fixture();
  await f.frame()();
  f.holdClose();
  const removed = Promise.withResolvers<void>();
  const subscription = f.workbench.resources.onDidRemove(() => {
    if (!f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)) removed.resolve();
  });
  try {
    f.workbench.resources.removed({ ...f.placement.resource!, id: "unrelated" });
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(true);
    f.workbench.resources.removed(f.placement.resource!);
    await f.closeStarted;
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(true);
    expect(f.disconnected).toEqual([]);
    f.resumeClose();
    await removed.promise;
    expect(f.disconnected).toEqual(["connection-1"]);
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(false);
  } finally {
    f.resumeClose();
    subscription.dispose();
  }
});

test("a removed guest's late close cannot remove a successor scope in the same viewer", async () => {
  const f = await fixture();
  await f.frame()();
  f.holdClose();
  const retired = Promise.withResolvers<void>();
  const subscription = f.workbench.notifications.subscribe((event) => {
    if (event.type === "show" && event.notification.title === "Close removed text editor failed") retired.resolve();
  });
  try {
    f.workbench.resources.removed(f.placement.resource!);
    await f.closeStarted;
    const successor = f.frame(f.placement, "ink.public-text-editor.view.editor", f.events, { source: "replacement" });
    expect(await successor()).toEqual({ token: "selected" });
    const version = f.workbench.resources.getRemovalVersion();
    f.resumeClose();
    await retired.promise;
    expect(f.workbench.resources.getRemovalVersion()).toBe(version);
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(true);
    expect(await successor()).toEqual({ token: "selected" });
  } finally {
    f.resumeClose();
    subscription.dispose();
  }
});

test("explicit close releases a removed installed editor while its automatic close barrier is blocked", async () => {
  const f = await fixture();
  await f.frame()();
  f.holdClose();
  try {
    f.workbench.resources.removed(f.placement.resource!);
    await f.closeStarted;
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(true);
    await f.workbench.closePlacement(f.placement.placementIdentity!);
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(false);
    expect(f.disconnected).toEqual(["connection-1"]);
  } finally {
    f.resumeClose();
  }
});

test("one webview uses its captured public scope and forwards events across adapter rerenders", async () => {
  const f = await fixture();
  expect(await f.frame()()).toEqual({ token: "selected" });
  expect(await f.frame()()).toEqual({ token: "selected" });
  expect(f.scopes).toEqual([{ kind: "placement", viewId: "ink.public-text-editor.view.editor", target: f.target }]);
  await f.streamReady;
  const received = Promise.withResolvers<void>();
  f.events.bind((event) => {
    f.delivered.push(event);
    received.resolve();
  });
  const event: TextEditingEvent = {
    type: "presence",
    memberId: crypto.randomUUID(),
    handle: "handle",
    version: 1,
    participants: [],
  };
  f.emit(event);
  await received.promise;
  expect(f.delivered).toEqual([{ scope: "editing.text", payload: event }]);
});

test("installed text participants reach the shared chrome and a closed member cannot restore them", async () => {
  const f = await fixture();
  const request = f.frame();
  const memberId = crypto.randomUUID();
  await request({ operation: "register", memberId });
  const opened = (await request({
    operation: "open",
    memberId,
    input: { grant: { token: "selected" } },
  })) as TextEditingOpened;
  await f.streamReady;
  const participant = { id: "peer", label: "Alex", deviceName: "Laptop", selection: null };
  const deliver = async (event: TextEditingEvent) => {
    const received = Promise.withResolvers<void>();
    f.events.bind(() => received.resolve());
    f.emit(event);
    await received.promise;
  };
  const presence: TextEditingEvent = {
    type: "presence",
    memberId,
    handle: opened.handle,
    version: 1,
    participants: [participant],
  };
  await deliver(presence);
  expect(f.workbench.presence.store.getState().participants).toEqual([{ id: "peer", label: "Alex" }]);
  await request({ operation: "close", handle: opened.handle });
  expect(f.workbench.presence.store.getState().participants).toEqual([]);
  await deliver({ ...presence, version: 2 });
  expect(f.workbench.presence.store.getState().participants).toEqual([]);
  await request({ operation: "register", memberId });
  const next = (await request({
    operation: "open",
    memberId,
    input: { grant: { token: "selected" } },
  })) as TextEditingOpened;
  await deliver({ ...presence, version: 3 });
  expect(f.workbench.presence.store.getState().participants).toEqual([]);
  await deliver({ ...presence, handle: next.handle, version: 1 });
  expect(f.workbench.presence.store.getState().participants).toEqual([{ id: "peer", label: "Alex" }]);
  f.events.unbind();
  expect(f.workbench.presence.store.getState().participants).toEqual([]);
});

test.each([
  "close",
  "abandon",
] as const)("a held %s receipt cannot restore or erase a successor's chrome presence", async (operation) => {
  const f = await fixture();
  const request = f.frame();
  const memberId = crypto.randomUUID();
  const open = async () => {
    await request({ operation: "register", memberId });
    return (await request({
      operation: "open",
      memberId,
      input: { grant: { token: "selected" } },
    })) as TextEditingOpened;
  };
  const presence = async (handle: string, version: number) => {
    const delivered = Promise.withResolvers<void>();
    f.events.bind(() => delivered.resolve());
    f.emit({
      type: "presence",
      memberId,
      handle,
      version,
      participants: [{ id: "peer", label: "Alex", deviceName: "Laptop", selection: null }],
    });
    await delivered.promise;
  };
  const original = await open();
  await f.streamReady;
  await presence(original.handle, 1);
  const held = operation === "close" ? f.holdNextOpen() : f.holdNextAbandon();
  const pending =
    operation === "close"
      ? request({ operation: "open", memberId, input: { grant: { token: "selected" } } })
      : request({ operation: "abandon", memberId });
  try {
    await held.entered.promise;
    if (operation === "close") {
      await request({ operation: "close", handle: original.handle });
      held.release.resolve();
      await pending;
      await presence(original.handle, 2);
      expect(f.workbench.presence.store.getState().participants).toEqual([]);
    } else {
      const successor = await open();
      expect(successor.handle).not.toBe(original.handle);
      await presence(successor.handle, 1);
      held.release.resolve();
      await pending;
      expect(f.workbench.presence.store.getState().participants).toEqual([{ id: "peer", label: "Alex" }]);
    }
  } finally {
    held.release.resolve();
    await pending;
  }
});

test("confirmed abandonment clears old presence when a same-ID successor is refused", async () => {
  const f = await fixture();
  const request = f.frame();
  const memberId = crypto.randomUUID();
  const open = () => request({ operation: "open", memberId, input: { grant: { token: "selected" } } });
  await request({ operation: "register", memberId });
  const original = (await open()) as TextEditingOpened;
  await f.streamReady;
  const delivered = Promise.withResolvers<void>();
  f.events.bind(() => delivered.resolve());
  f.emit({
    type: "presence",
    memberId,
    handle: original.handle,
    version: 1,
    participants: [{ id: "peer", label: "Alex", deviceName: "Laptop", selection: null }],
  });
  await delivered.promise;
  expect(f.workbench.presence.store.getState().participants).toHaveLength(1);
  const held = f.holdNextAbandon();
  const abandoned = request({ operation: "abandon", memberId });
  try {
    await held.entered.promise;
    await request({ operation: "register", memberId });
    f.refuseNextOpen();
    await expect(open()).rejects.toMatchObject({ code: "source_read_only" });
    held.release.resolve();
    await abandoned;
    expect(f.workbench.presence.store.getState().participants).toEqual([]);
  } finally {
    held.release.resolve();
    await abandoned;
  }
});

test("custom presence received before admission waits for its handle and follows project activation", async () => {
  const f = await fixture();
  const request = f.frame();
  const memberId = crypto.randomUUID();
  await request({ operation: "register", memberId });
  await f.streamReady;
  const held = f.holdNextOpen();
  const opening = request({ operation: "open", memberId, input: { grant: { token: "selected" } } });
  try {
    await held.entered.promise;
    const delivered = Promise.withResolvers<void>();
    f.events.bind(() => delivered.resolve());
    f.emit({
      type: "presence",
      memberId,
      handle: held.handle,
      version: 1,
      participants: [{ id: "peer", label: "Sam", deviceName: "Desktop", selection: null }],
    });
    await delivered.promise;
    expect(f.workbench.presence.store.getState().participants).toEqual([]);
    held.release.resolve();
    await opening;
    expect(f.workbench.presence.store.getState().participants).toEqual([{ id: "peer", label: "Sam" }]);
    f.workbench.activation.setActive(false);
    expect(f.workbench.presence.store.getState().participants).toEqual([]);
    f.workbench.activation.setActive(true);
    expect(f.workbench.presence.store.getState().participants).toEqual([{ id: "peer", label: "Sam" }]);
    await request({ operation: "abandon", memberId });
    expect(f.workbench.presence.store.getState().participants).toEqual([]);
  } finally {
    held.release.resolve();
    await opening;
  }
});

test("public text workbench participation follows project activation without closing its source", async () => {
  const f = await fixture();
  f.workbench.activation.setActive(false);
  await f.frame()();
  await f.streamReady;
  expect(new Set(f.active)).toEqual(new Set([false]));
  f.workbench.activation.setActive(true);
  await f.waitActive(true);
  f.workbench.activation.setActive(false);
  await f.waitActive(false);
  expect(f.scopes).toHaveLength(1);
  expect(f.disconnected).toEqual([]);
});

test("public text workbench participation uses the current project activation after held admission", async () => {
  const f = await fixture();
  f.holdConnection();
  const opening = f.frame()();
  await f.connectionStarted;
  f.workbench.activation.setActive(false);
  f.resumeConnection();
  await opening;
  await f.streamReady;
  expect(new Set(f.active)).toEqual(new Set([false]));
});

test("public text admission waits for current participation after an older activity acknowledgement", async () => {
  const f = await fixture();
  const first = f.holdActivity(true);
  const current = f.holdActivity(false);
  const opening = f.frame()();
  try {
    await first.entered.promise;
    f.workbench.activation.setActive(false);
    first.release.resolve();
    await current.entered.promise;
    expect(f.guests()).toBe(0);
    expect(f.requests).toEqual([]);
    current.release.resolve();
    await opening;
    expect(f.active.at(-1)).toBe(false);
  } finally {
    first.release.resolve();
    current.release.resolve();
    await opening.catch(() => {});
  }
});

test("ordinary placement close waits for the public guest barrier before removing its view", async () => {
  const f = await fixture();
  await f.frame()();
  f.holdClose();
  const closing = f.workbench.closePlacement(f.placement.placementIdentity!);
  await f.closeStarted;
  expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(true);
  f.resumeClose();
  await closing;
  expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(false);
  expect(f.disconnected).toEqual(["connection-1"]);
});

test("a disconnected opening guest cannot publish its late connection into a replacement", async () => {
  const f = await fixture();
  f.holdConnection();
  const opening = f.frame()();
  await f.connectionStarted;
  f.events.unbind();
  f.resumeConnection();
  await expect(opening).rejects.toMatchObject({ code: "session_closed" });
  expect(f.disconnected).toEqual(["connection-1"]);
  f.events.bind((event) => f.delivered.push(event));
  expect(await f.frame()()).toEqual({ token: "selected" });
  expect(f.scopes).toHaveLength(2);
});

test("a request waiting for its guest cannot enter a viewer that changed project", async () => {
  const f = await fixture();
  await f.frame()();
  const late = f.frame()();
  f.workbench.pageLocations.setProject("other");
  await expect(late).rejects.toMatchObject({ code: "session_closed" });
  expect(f.requests).toEqual(["current"]);
});

test("an interrupted forced disconnect remains owned until disposal can finish it", async () => {
  const f = await fixture();
  await f.frame()();
  f.refuseDisconnect();
  f.events.unbind();
  await expect(f.workbench.dispose()).rejects.toMatchObject({ code: "source_unavailable" });
  await f.workbench.dispose();
  expect(f.disconnected).toEqual(["connection-1", "connection-1"]);
});

test("a retained webview rebound to a new source cannot reuse its old public connection", async () => {
  const f = await fixture();
  await f.frame()();
  f.workbench.navigation.openTarget(openFile("successor"));
  const successor = f.workbench.layout.getActivePanel("main")!;
  expect(successor.resource?.id).toBe("successor");
  await f.frame(successor)();
  expect(f.scopes).toHaveLength(2);
  expect(f.scopes[1]).toMatchObject({ target: { resource: { id: "successor" } } });
});

test("a failed initial connection can retry without retaining a permanently rejected owner", async () => {
  const f = await fixture();
  f.refuseConnection();
  await expect(f.frame()()).rejects.toMatchObject({ code: "source_unavailable" });
  expect(await f.frame()()).toEqual({ token: "selected" });
  expect(f.scopes).toHaveLength(2);
});

test("changing the selected presentation retires its old scope even when its viewer stays current", async () => {
  const f = await fixture();
  await f.frame()();
  await f.frame(f.placement, "ink.public-text-editor.view.successor")();
  expect(f.scopes).toHaveLength(2);
  expect(f.scopes[1]).toMatchObject({ viewId: "ink.public-text-editor.view.successor" });
});

test("Workbench disposal drains admitted guests while refusing another publisher's admission", async () => {
  const f = await fixture();
  await f.frame()();
  f.holdClose();
  const disposing = f.workbench.dispose();
  await f.closeStarted;
  const successor = createHostEventPublisher();
  successor.bind(() => {});
  try {
    await expect(f.frame(f.placement, undefined, successor)()).rejects.toMatchObject({ code: "session_closed" });
    expect(f.scopes).toHaveLength(1);
  } finally {
    f.resumeClose();
    await disposing;
    successor.unbind();
  }
});

test("a request awaiting a resolved guest cannot enter its retired presentation scope", async () => {
  const f = await fixture();
  await f.frame()();
  const late = f.frame()();
  const successor = f.frame(f.placement, "ink.public-text-editor.view.successor")();
  await expect(late).rejects.toMatchObject({ code: "session_closed" });
  await successor;
  expect(f.requests).toEqual(["current", "current"]);
});

test("selected page parameters own the scope while equivalent parameter ordering preserves it", async () => {
  const f = await fixture();
  await f.frame(f.placement, undefined, f.events, { file: "first", filter: ["body"] })();
  await f.frame(f.placement, undefined, f.events, { filter: ["body"], file: "first" })();
  expect(f.scopes).toHaveLength(1);
  await f.frame(f.placement, undefined, f.events, { file: "second", filter: ["body"] })();
  expect(f.scopes).toHaveLength(2);
  expect(f.scopes[1]).toMatchObject({ target: { pageParams: { file: "second" } } });
});

test("late cleanup from a replaced selected scope cannot abandon its same-ID successor", async () => {
  const f = await fixture();
  const old = f.frame(f.placement, undefined, f.events, { file: "first" });
  const memberId = crypto.randomUUID();
  await old({ operation: "register", memberId });
  await old({ operation: "open", memberId, input: { grant: { token: "selected" } } });
  const next = f.frame(f.placement, undefined, f.events, { file: "second" });
  await next({ operation: "register", memberId });
  const opened = (await next({
    operation: "open",
    memberId,
    input: { grant: { token: "selected" } },
  })) as TextEditingOpened;
  const before = f.requests.length;
  await expect(old({ operation: "abandon", memberId })).rejects.toMatchObject({ code: "session_closed" });
  await expect(old({ operation: "close", handle: opened.handle })).rejects.toMatchObject({ code: "session_closed" });
  expect(f.requests).toHaveLength(before);
  expect(
    (await next({ operation: "open", memberId, input: { grant: { token: "selected" } } })) as TextEditingOpened,
  ).toMatchObject({ handle: opened.handle });
});

test("late cleanup from a departed viewer generation cannot release its same-scope same-ID successor", async () => {
  const f = await fixture();
  const old = f.frame();
  const memberId = crypto.randomUUID();
  await old({ operation: "register", memberId });
  await old({ operation: "open", memberId, input: { grant: { token: "selected" } } });
  f.workbench.pageLocations.closePlacement(f.placement.placementIdentity!);
  await f.workbench.navigation.openTarget(openFile("document"));
  const placement = f.workbench.layout.getActivePanel("main")!;
  const next = f.frame(placement);
  await next({ operation: "register", memberId });
  const opened = (await next({
    operation: "open",
    memberId,
    input: { grant: { token: "selected" } },
  })) as TextEditingOpened;
  const before = f.requests.length;
  await expect(old({ operation: "abandon", memberId })).rejects.toThrow();
  await expect(old({ operation: "close", handle: opened.handle })).rejects.toThrow();
  expect(f.requests).toHaveLength(before);
  expect(
    (await next({ operation: "open", memberId, input: { grant: { token: "selected" } } })) as TextEditingOpened,
  ).toMatchObject({ handle: opened.handle });
});

test("a current adapter rerender can close the same admitted guest without reopening", async () => {
  const f = await fixture();
  const request = f.frame();
  const memberId = crypto.randomUUID();
  await request({ operation: "register", memberId });
  const opened = (await request({
    operation: "open",
    memberId,
    input: { grant: { token: "selected" } },
  })) as TextEditingOpened;
  await f.frame()({ operation: "close", handle: opened.handle });
  expect(f.scopes).toHaveLength(1);
  expect(f.requests.filter((value) => value === "close")).toHaveLength(1);
});
