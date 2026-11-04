import { expect, test } from "bun:test";
import { createSyncSpace, openLive } from "pstdio-sync/encryption";
import { createLiveConnection } from "pstdio-sync/relay";
import { liveProtocolHeader, liveProtocolVersion } from "pstdio-sync-contracts";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createTestApp } from "../../test-utils/create-test-app";
import { personalLiveTopic } from "../personal-history/live-messages";
import { startRelayPersonalHistory } from "./personal";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 4000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(5);
  expect(await condition()).toBe(true);
};

type Wire = { upstream: WebSocket; queued: string[]; socket?: Bun.ServerWebSocket<Wire>; heldId?: string };
const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };

test("a sole preview during held ownership is captured and replayed after private admission without another chunk", async () => {
  const app = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const captureEntered = Promise.withResolvers<void>();
  const captureRelease = Promise.withResolvers<void>();
  let sync: ReturnType<typeof startRelayPersonalHistory> | undefined;
  let observer: ReturnType<typeof createLiveConnection> | undefined;
  let stop: (() => void) | undefined;
  let privateTopic = "";
  let held: { socket: Bun.ServerWebSocket<Wire>; text: string } | undefined;
  const sourcePublications: { spaceOwner: string | null; topic: string; payload: string }[] = [];
  const proxy = Bun.serve<Wire>({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request, server) {
      const url = new URL(request.url);
      if (!url.pathname.endsWith("/live"))
        return fetch(new Request(new URL(url.pathname + url.search, peer.origin), request));
      const upstreamUrl = new URL(url.pathname + url.search, peer.origin);
      upstreamUrl.protocol = "ws:";
      const upstream = new NativeWebSocket(upstreamUrl, {
        headers: {
          authorization: request.headers.get("authorization")!,
          [liveProtocolHeader]: String(liveProtocolVersion),
        },
      });
      const state: Wire = { upstream, queued: [] };
      upstream.onopen = () => {
        for (const text of state.queued.splice(0)) upstream.send(text);
      };
      upstream.onmessage = (event) => {
        const text = String(event.data);
        const value = JSON.parse(text);
        if (value.type === "control-result" && value.requestId === state.heldId) {
          held = { socket: state.socket!, text };
        } else state.socket?.send(text);
      };
      upstream.onclose = () => state.socket?.close();
      upstream.onerror = () => state.socket?.close();
      if (server.upgrade(request, { data: state })) return;
      upstream.close();
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.data.socket = socket;
      },
      message(socket, data) {
        const text = String(data);
        const value = JSON.parse(text);
        if (value.type === "subscribe" && value.spaceOwner === "bob" && value.topic === privateTopic)
          socket.data.heldId = value.requestId;
        if (value.type === "publish" && value.spaceOwner === "bob" && value.topic === privateTopic)
          sourcePublications.push(value);
        if (socket.data.upstream.readyState === WebSocket.OPEN) socket.data.upstream.send(text);
        else socket.data.queued.push(text);
      },
      close(socket) {
        socket.data.upstream.close();
      },
    },
  });
  try {
    const project = await app.deps.projectService.create({ name: "Initial admission preview" });
    const session = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Sole preview",
      status: "in_progress",
      agent: "unavailable",
    });
    const conversation = await app.deps.sessionService.store.create(session.id, inertSessionChannelHooks)
      .conversationReady;
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: "bob",
      keys: [{ generation: 1, secret: "B".repeat(43) }],
    });
    privateTopic = await personalLiveTopic(space);
    app.deps.accountService.devices = async () => {
      captureEntered.resolve();
      await captureRelease.promise;
      return [];
    };
    sync = startRelayPersonalHistory({
      deps: app.deps,
      config: {
        accountId: "bob",
        workbenchId: project.id,
        environmentId: "bob-source",
        managerOrigin: peer.origin,
        relayOrigin: proxy.url.origin,
        renewalGrant: "grant",
      },
      signal: controller.signal,
      access: async () => ({ token: "bob-source", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    await captureEntered.promise;
    await until(() => !!held);
    const message = {
      id: "only-preview",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "One chunk before ownership capture returns" }],
    };
    conversation.push({ op: "add", path: "/messages/0", value: message });
    captureRelease.resolve();
    await until(() => sourcePublications.length > 0);
    const firstFrames = JSON.parse(
      new TextDecoder().decode(
        await openLive(space, {
          ...sourcePublications[0]!,
          deviceId: "bob-source",
        }),
      ),
    );
    expect(JSON.parse(firstFrames[0].text)).toEqual(message);
    expect(held).toBeDefined();

    // The first publication had no reader. A late reader and the private ACK must recover the resident preview.
    const received: unknown[] = [];
    observer = createLiveConnection({
      origin: peer.origin,
      projectId: project.id,
      signal: controller.signal,
      access: async () => ({ token: "bob-observer", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
    stop = observer.listen((event) => {
      if (event.type === "event")
        void openLive(space, event).then((clear) => {
          for (const frame of JSON.parse(new TextDecoder().decode(clear)))
            if (frame.end) received.push(JSON.parse(frame.text));
        });
    });
    observer.subscribe({ spaceOwner: "bob", topic: privateTopic });
    await until(() =>
      peer
        .subscriptions()
        .some(
          (entry) => entry.deviceId === "bob-observer" && entry.topics.includes(JSON.stringify(["bob", privateTopic])),
        ),
    );
    held!.socket.send(held!.text);
    held = undefined;
    await until(() => received.length > 0);
    expect(received).toContainEqual(message);
    expect(sourcePublications.length).toBeGreaterThan(1);
    expect(conversation.getMessages()).toEqual([message]);
  } finally {
    captureRelease.resolve();
    stop?.();
    sync?.close();
    controller.abort();
    observer?.close();
    await Promise.all([sync?.done, observer?.done]);
    await proxy.stop(true);
    await peer.close();
    await app.close();
  }
});
