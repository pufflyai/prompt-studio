import { expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLiveConnection } from "pstdio-sync/relay";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createPersonalLive } from "./personal-live";

test("closing a personal owner during topic derivation leaves no subscription on its shared socket", async () => {
  const peer = documentPeer();
  const controller = new AbortController();
  const live = createLiveConnection({
    origin: peer.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
  });
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: "B".repeat(43) }],
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const channel = createPersonalLive({ live, owns: () => false, received: async () => {}, changed: () => {} });
  try {
    const preparing = channel.prepare({
      ...space,
      documentId: async (name) => {
        entered.resolve();
        await release.promise;
        return space.documentId(name);
      },
    });
    await entered.promise;
    channel.close();
    release.resolve();
    await preparing;
    const barrier = Promise.withResolvers<void>();
    const stop = live.listen((event) => {
      if (event.type === "subscribers" && event.topic === "opaque_barrier_123456") barrier.resolve();
    });
    const unfollow = live.follow({ spaceOwner: null, topic: "opaque_barrier_123456" }, () => {});
    await barrier.promise;
    expect(peer.subscriptions().flatMap((entry) => entry.topics)).toEqual([]);
    stop();
    unfollow();
  } finally {
    release.resolve();
    channel.close();
    controller.abort();
    await live.done;
    await peer.close();
  }
});
