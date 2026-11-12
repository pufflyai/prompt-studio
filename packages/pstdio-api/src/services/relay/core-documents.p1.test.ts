import { expect, test } from "bun:test";
import { createLiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { startCoreDocumentSync } from "./core-documents";

test("Retry finishes core download after a relay response stops arriving", async () => {
  const app = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let hold = true;
  const relay = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (hold && url.pathname.endsWith("/read")) {
        hold = false;
        return new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(new TextEncoder().encode("{"));
              held.resolve();
              void release.promise.then(() => {
                try {
                  stream.close();
                } catch {}
              });
            },
          }),
        );
      }
      return fetch(new Request(new URL(url.pathname, peer.origin), request));
    },
  });
  const project = await app.deps.projectService.create({ name: "Cloud download" });
  const access = async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const live = createLiveConnection({ origin: peer.origin, projectId: project.id, access, signal: controller.signal });
  const ready = Promise.withResolvers<void>();
  const sync = startCoreDocumentSync({
    deps: app.deps,
    config: {
      accountId: "alice",
      workbenchId: project.id,
      environmentId: "device",
      managerOrigin: peer.origin,
      relayOrigin: relay.url.origin,
      renewalGrant: "grant",
    },
    signal: controller.signal,
    access,
    live,
    statusChanged: () => {
      void sync.status().then((status) => {
        if (status.downloaded && !status.busy) ready.resolve();
      });
    },
  });
  try {
    await held.promise;
    expect(await sync.status()).toMatchObject({ downloaded: false, busy: true });
    sync.retry();
    await ready.promise;
    expect(await sync.status()).toMatchObject({
      firstDownloaded: true,
      downloaded: true,
      needsAttention: false,
      pendingItems: 0,
      download: { completed: 2, total: 2 },
    });
    expect(live.status().connected).toBe(true);
  } finally {
    release.resolve();
    sync.close();
    controller.abort();
    await Promise.all([sync.done, live.done]);
    await relay.stop(true);
    await peer.close();
    await app.close();
  }
});

test("removing core document sync closes while access renewal is still pending", async () => {
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const controller = new AbortController();
  const access = () => {
    entered.resolve();
    return renewal.promise;
  };
  const connection = startCoreDocumentSync({
    deps: app.deps,
    config: {
      accountId: "account",
      workbenchId: "project",
      environmentId: "device",
      relayOrigin: "http://127.0.0.1:9",
      managerOrigin: "http://127.0.0.1:9",
      renewalGrant: "grant",
    },
    signal: controller.signal,
    access,
    live: createLiveConnection({
      origin: "http://127.0.0.1:9",
      projectId: "project",
      access,
      signal: controller.signal,
    }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await entered.promise;
    connection.close();
    const outcome = await Promise.race([
      connection.done.then(() => "closed"),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve("waiting"), 100);
      }),
    ]);
    expect(outcome).toBe("closed");
  } finally {
    clearTimeout(timer);
    renewal.resolve({ token: "unused", expiresAt: new Date().toISOString() });
    controller.abort();
    await connection.done;
    await app.close();
  }
});
