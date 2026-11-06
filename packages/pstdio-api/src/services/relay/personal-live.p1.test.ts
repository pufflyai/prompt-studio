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
  const channel = createPersonalLive({
    live,
    history: { readingSessions: () => ["session"], watchReaders: () => () => {} },
    owns: () => false,
    received: async () => {},
    changed: () => {},
  });
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

test("reader subscriptions start previews immediately and closing the last reader stops them", async () => {
  const peer = documentPeer();
  const controller = new AbortController();
  const connect = (device: string) =>
    createLiveConnection({
      origin: peer.origin,
      projectId: "project",
      signal: controller.signal,
      access: async () => ({ token: device, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    });
  const sender = connect("sender");
  const reader = connect("reader");
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "alice",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  let reading = false;
  let changed: (() => void) | undefined;
  const history = {
    readingSessions: () => (reading ? ["session"] : []),
    watchReaders: (listener: () => void) => {
      changed = listener;
      return () => {};
    },
  };
  const source = createPersonalLive({
    live: sender,
    history: { readingSessions: () => [], watchReaders: () => () => {} },
    owns: () => false,
    changed: () => {},
    received: async () => {},
  });
  const destination = createPersonalLive({
    live: reader,
    history,
    owns: () => false,
    changed: () => {},
    received: async () => {},
  });
  try {
    await source.prepare(space, ["session"]);
    await destination.prepare(space, []);
    expect(source.watching("session")).toBe(false);
    reading = true;
    changed?.();
    const end = Date.now() + 500;
    while (!source.watching("session") && Date.now() < end) await Bun.sleep(5);
    expect(source.watching("session")).toBe(true);
    reading = false;
    changed?.();
    const closed = Date.now() + 1000;
    while (source.watching("session") && Date.now() < closed) await Bun.sleep(5);
    expect(source.watching("session")).toBe(false);
  } finally {
    source.close();
    destination.close();
    controller.abort();
    await Promise.all([sender.done, reader.done]);
    await peer.close();
  }
});

test("reader-change derivation failures stay handled and the next preparation can subscribe", async () => {
  const peer = documentPeer();
  const controller = new AbortController();
  const live = createLiveConnection({
    origin: peer.origin,
    projectId: "project",
    signal: controller.signal,
    access: async () => ({ token: "reader", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
  });
  const base = await createSyncSpace({
    projectId: "project",
    spaceOwner: "alice",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  let reading = false;
  let changed = () => {};
  let fail = true;
  const entered = Promise.withResolvers<void>();
  const errors: unknown[] = [];
  const unhandled = (error: unknown) => {
    errors.push(error);
  };
  process.on("unhandledRejection", unhandled);
  const space = {
    ...base,
    documentId: async (name: string) => {
      if (fail) {
        fail = false;
        entered.resolve();
        throw new Error("Transient topic derivation");
      }
      return base.documentId(name);
    },
  };
  const channel = createPersonalLive({
    live,
    history: {
      readingSessions: () => (reading ? ["session"] : []),
      watchReaders: (listener) => {
        changed = listener;
        return () => {};
      },
    },
    owns: () => false,
    received: async () => {},
    changed: () => {},
  });
  try {
    await channel.prepare(space);
    reading = true;
    changed();
    await entered.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(errors).toEqual([]);
    await channel.prepare(space);
    const barrier = Promise.withResolvers<void>();
    const stop = live.listen((event) => {
      if (event.type === "subscribers" && event.topic === "opaque_recovery_barrier") barrier.resolve();
    });
    const unfollow = live.follow({ spaceOwner: null, topic: "opaque_recovery_barrier" }, () => {});
    await barrier.promise;
    expect(peer.subscriptions().flatMap((entry) => entry.topics)).toHaveLength(2);
    stop();
    unfollow();
  } finally {
    process.removeListener("unhandledRejection", unhandled);
    channel.close();
    controller.abort();
    await live.done;
    await peer.close();
  }
});
