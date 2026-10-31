import { afterEach, expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import type { PageParams } from "@pstdio/sdk/extensions";
import type { TextEditingEvent } from "pstdio-api-contracts/extension-kernel";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { harness, navigate, openFile } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const fixtures: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const stop of fixtures.splice(0)) await stop();
});

// The remote is controlled; transport, guest multiplexing, capability gate and Workbench are real.
const fixture = async () => {
  const scopes: unknown[] = [];
  const disconnected: string[] = [];
  const active: boolean[] = [];
  const requests: string[] = [];
  const connectionStarted = Promise.withResolvers<void>();
  const closeStarted = Promise.withResolvers<void>();
  const streamReady = Promise.withResolvers<void>();
  const releaseConnection = Promise.withResolvers<void>();
  const releaseClose = Promise.withResolvers<void>();
  let holdConnection = false;
  let refuseConnection = false;
  let holdClose = false;
  let refuseDisconnect = false;
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();
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
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const input = (await request.json()) as {
        token?: string;
        active?: boolean;
        request?: { operation: string };
      };
      if (path.endsWith("/text-editing")) return connect(input);
      if (path.endsWith("/active")) {
        active.push(input.active!);
        return reply();
      }
      if (path.endsWith("/request")) {
        requests.push(input.request!.operation);
        return reply({ token: "selected" });
      }
      if (path.endsWith("/prepare-close")) {
        closeStarted.resolve();
        if (holdClose) await releaseClose.promise;
        return reply();
      }
      if (path.endsWith("/disconnect")) return disconnect(input.token!);
      if (path.endsWith("/stream")) {
        let current: ReadableStreamDefaultController<Uint8Array>;
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              current = controller;
              streams.add(controller);
              controller.enqueue(encoder.encode(": ready\n\n"));
              streamReady.resolve();
            },
            cancel() {
              streams.delete(current);
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      }
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
  const transport = createClient({ baseUrl: server.url.href }).textEditing;
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
    return () => gate.call({ method: "editing.text", params: { operation: "current" } });
  };
  const value = {
    workbench,
    placement,
    events,
    delivered,
    target,
    scopes,
    active,
    disconnected,
    requests,
    connectionStarted: connectionStarted.promise,
    closeStarted: closeStarted.promise,
    streamReady: streamReady.promise,
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
    emit(event: TextEditingEvent) {
      for (const controller of streams)
        controller.enqueue(encoder.encode(`event: text\ndata: ${JSON.stringify(event)}\n\n`));
    },
    async stop() {
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
