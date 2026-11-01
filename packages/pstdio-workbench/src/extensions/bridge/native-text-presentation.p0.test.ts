import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import * as Y from "yjs";
import { harness, navigate, openFile } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createNativeTextPresentation } from "./native-text-presentation";

// A controlled HTTP peer. SDK, capability dispatch, placement ownership and close are production code.
const fixture = () => {
  const document = new Y.Doc();
  document.getText("content").insert(0, "source");
  const calls: string[] = [];
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let holdOpen = false;
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
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const input = (await request.json()) as {
        request?: WireRequest;
        active?: boolean;
      };
      if (path.endsWith("/text-editing")) {
        calls.push("connect");
        if (refuseConnection) {
          refuseConnection = false;
          return Response.json({
            ok: false,
            error: { code: "source_unavailable", message: "Opening interrupted", retryable: true },
          });
        }
        return reply({ token: "connection" });
      }
      if (path.endsWith("/stream"))
        return new Response(
          new ReadableStream({
            start(controller) {
              streams.add(controller);
              controller.enqueue(new TextEncoder().encode(": ready\n\n"));
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
  const presentation = createNativeTextPresentation({
    workbench,
    placement,
    projectId: "project",
    textEditing: createClient({ baseUrl: server.url.href }).textEditing,
    textTarget: { fileRendererId: "paper.source.view.markdown", resource: placement.resource },
  });
  return {
    workbench,
    placement,
    presentation,
    calls,
    document,
    entered: entered.promise,
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

test("native Markdown uses the selected public session and drains its close handlers before removing the placement", async () => {
  const f = fixture();
  try {
    const session = await f.presentation.open();
    session.transact((text) => text.insert(text.length, " LOCAL"));
    await session.flush();
    expect(f.document.getText("content").toString()).toBe("source LOCAL");
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const stop = session.beforeClose(async () => {
      entered.resolve();
      await release.promise;
    });
    const closing = f.workbench.closePlacement(f.placement.placementIdentity!);
    await entered.promise;
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(true);
    expect(f.calls).not.toContain("disconnect");
    release.resolve();
    await closing;
    stop();
    expect(f.workbench.host.getOpenPlacementIds().has(f.placement.instanceId)).toBe(false);
    expect(f.calls.indexOf("current")).toBeLessThan(f.calls.indexOf("open"));
    expect(f.calls.indexOf("close")).toBeLessThan(f.calls.indexOf("disconnect"));
    await f.presentation.close();
    await expect(f.presentation.open()).rejects.toMatchObject({ code: "session_closed" });
  } finally {
    await f.stop();
  }
});

test("native Retry recovers failed initial admission and retains an already admitted public session", async () => {
  const f = fixture();
  f.refuseConnection();
  try {
    await expect(f.presentation.open()).rejects.toMatchObject({ code: "source_unavailable" });
    const session = await f.presentation.retry();
    session.transact((text) => text.insert(text.length, " kept"));
    expect(await f.presentation.retry()).toBe(session);
    expect(f.calls.filter((call) => call === "open")).toHaveLength(1);
    expect(f.document.getText("content").toString()).toBe("source kept");
  } finally {
    await f.stop();
  }
});

test("native close owns an opening public session until it can release the same member", async () => {
  const f = fixture();
  f.holdOpen();
  try {
    const opening = f.presentation.open();
    await f.entered;
    const closing = f.workbench.closePlacement(f.placement.placementIdentity!);
    expect(f.calls).not.toContain("disconnect");
    await expect(f.presentation.retry()).rejects.toMatchObject({ code: "session_closed" });
    f.resume();
    await opening;
    await closing;
    expect(f.calls.filter((call) => call === "connect")).toHaveLength(1);
    expect(f.calls.filter((call) => call === "open")).toHaveLength(1);
    expect(f.calls).toContain("close");
    expect(f.calls).toContain("disconnect");
  } finally {
    await f.stop();
  }
});

test("a failed native Retry keeps the admitted public session and its unacknowledged text", async () => {
  const f = fixture();
  try {
    const session = await f.presentation.open();
    f.refuseSubmit(true);
    session.transact((text) => text.insert(text.length, " kept"));
    await expect(f.presentation.retry()).rejects.toMatchObject({ code: "source_unavailable" });
    expect(session.getSnapshot().pending).toBe(true);
    expect(session.getSnapshot().text.toString()).toBe("source kept");
    f.refuseSubmit(false);
    expect(await f.presentation.retry()).toBe(session);
    expect(f.calls.filter((call) => call === "connect")).toHaveLength(1);
    expect(f.calls.filter((call) => call === "open")).toHaveLength(1);
    expect(f.document.getText("content").toString()).toBe("source kept");
  } finally {
    await f.stop();
  }
});
