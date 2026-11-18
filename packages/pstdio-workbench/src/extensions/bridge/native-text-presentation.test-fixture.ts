import { createClient } from "@pstdio/sdk/client";
import * as Y from "yjs";
import { harness, navigate, openFile } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createNativeTextPresentation } from "./native-text-presentation";

// A controlled HTTP peer. SDK, capability dispatch, placement ownership and close are production code.
export const nativeTextFixture = () => {
  const document = new Y.Doc();
  document.getText("content").insert(0, "source");
  const calls: string[] = [];
  const entered = Promise.withResolvers<void>();
  const connectionEntered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let holdOpen = false;
  let holdConnection = false;
  const connectionObservers = new Set<() => void>();
  let refuseConnection = false;
  let refuseSubmit = false;
  let revision = 1;
  const snapshot = () => ({
    state: Buffer.from(Y.encodeStateAsUpdate(document)).toString("base64"),
    seedId: "history",
    sourceSeedId: "history",
    revision,
    editable: true,
  });
  const reply = (value?: unknown) => Response.json({ ok: true, value });
  type WireRequest = { operation: string; memberId: string; update?: string };
  const call = async (input: WireRequest) => {
    const operation = input.operation;
    calls.push(operation);
    if (operation === "current") return reply({ token: "selected" });
    if (operation === "open") {
      entered.resolve();
      if (holdOpen) await release.promise;
      return reply({
        handle: input.memberId,
        grant: { token: "selected" },
        sourceIdentity: "a".repeat(64),
        snapshot: snapshot(),
      });
    }
    if (operation === "submit") {
      if (refuseSubmit)
        return Response.json({
          ok: false,
          error: { code: "source_unavailable", message: "Write interrupted", retryable: true },
        });
      Y.applyUpdate(document, Buffer.from(input.update!, "base64"));
      revision++;
      return reply(snapshot());
    }
    if (operation === "snapshot") return reply(snapshot());
    if (operation === "project") return reply({ revision });
    return reply();
  };
  const connectPeer = async (initial?: { memberId: string }) => {
    calls.push("connect");
    connectionEntered.resolve();
    if (holdConnection) await release.promise;
    for (const notify of connectionObservers) notify();
    if (refuseConnection) {
      refuseConnection = false;
      return Response.json({
        ok: false,
        error: { code: "source_unavailable", message: "Opening interrupted", retryable: true },
      });
    }
    if (initial) {
      calls.push("initial");
      const response = await call({ operation: "open", memberId: initial.memberId });
      return reply({ token: "connection", opened: (await response.json()).value });
    }
    return reply({ token: "connection" });
  };
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path.includes("/session-stream/") && path.includes("/subscriptions"))
        return new Response(null, { status: 204 });
      const input = (request.method === "POST" ? await request.json() : {}) as {
        request?: WireRequest;
        active?: boolean;
        initial?: { memberId: string };
      };
      if (path.endsWith("/text-editing") || path.endsWith("/text-editing/open")) {
        return connectPeer(input.initial);
      }
      if (path === "/v1/session-stream")
        return new Response(
          new ReadableStream({
            start(controller) {
              streams.add(controller);
              controller.enqueue(new TextEncoder().encode('event: connected\ndata: {"connection_id":"shared"}\n\n'));
            },
            cancel() {},
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      if (path.endsWith("/request")) return call(input.request!);
      calls.push(path.split("/").at(-1)!);
      return reply();
    },
  });
  const workbench = harness();
  workbench.navigation.openTarget(navigate("workspace"));
  workbench.navigation.openTarget(openFile("document"));
  const placement = workbench.layout.getActivePanel("main")!;
  const connect = () =>
    createNativeTextPresentation({
      workbench,
      placement,
      projectId: "project",
      textEditing: createClient({ baseUrl: server.url.href }).textEditing,
      textTarget: { fileRendererId: "paper.source.view.markdown", resource: placement.resource },
    });
  const presentation = connect();
  return {
    connect,
    workbench,
    placement,
    presentation,
    calls,
    document,
    entered: entered.promise,
    connectionEntered: connectionEntered.promise,
    holdConnection() {
      holdConnection = true;
    },
    waitConnections(count: number) {
      if (calls.filter((call) => call === "connect").length >= count) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const notify = () => {
          if (calls.filter((call) => call === "connect").length < count) return;
          connectionObservers.delete(notify);
          resolve();
        };
        connectionObservers.add(notify);
      });
    },
    holdOpen() {
      holdOpen = true;
    },
    refuseConnection() {
      refuseConnection = true;
    },
    refuseSubmit(value: boolean) {
      refuseSubmit = value;
    },
    resume() {
      release.resolve();
    },
    async stop() {
      release.resolve();
      await presentation.close();
      await workbench.dispose();
      for (const stream of streams) {
        try {
          stream.close();
        } catch {}
      }
      await server.stop(true);
      document.destroy();
    },
  };
};
