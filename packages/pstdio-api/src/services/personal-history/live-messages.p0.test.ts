import { expect, test } from "bun:test";
import { createSyncSpace, openLive } from "pstdio-sync/encryption";
import { createSessionStore } from "../../features/sessions/session-store";
import { inertSessionChannelHooks } from "../../features/sessions/session-store.test-utils";
import { createLivePublisher, createLiveReceiver } from "./live-messages";

test("large Unicode streaming text arrives whole in bounded encrypted frames and late previews cannot replace completed messages", async () => {
  const sessions = createSessionStore();
  const conversation = await sessions.create("session", inertSessionChannelHooks).conversationReady;
  const message = {
    id: "message",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: '😀 "\n'.repeat(10_000) }],
  };
  conversation.push({ op: "add", path: "/messages/0", value: message });
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const publisher = createLivePublisher({ deviceId: "device", sessions });
  const arrived = Promise.withResolvers<unknown>();
  let deliveries = 0;
  const receiver = createLiveReceiver((_id, _index, received) => {
    deliveries++;
    arrived.resolve(received);
  });
  const frames: unknown[] = [];
  try {
    publisher.live("session", space, async (frame) => {
      expect(Buffer.byteLength(JSON.stringify(frame))).toBeLessThan(64 * 1024);
      const value = JSON.parse(new TextDecoder().decode(await openLive(space, { ...frame, deviceId: "device" })));
      frames.push(value);
      receiver.receive(value);
    });
    expect(await arrived.promise).toEqual(message);
    expect(frames.length).toBeGreaterThan(1);
    receiver.completed("session", 0);
    for (const value of frames) receiver.receive(value);
    expect(deliveries).toBe(1);
  } finally {
    publisher.close();
    receiver.close();
    sessions.remove("session");
  }
});

test("a large streaming snapshot leaves room for another session in the first preview tick", async () => {
  const sessions = createSessionStore();
  for (const [id, text] of [
    ["large", "x".repeat(1_000_000)],
    ["small", "a new reply"],
  ]) {
    const conversation = await sessions.create(id!, inertSessionChannelHooks).conversationReady;
    conversation.push({
      op: "add",
      path: "/messages/0",
      value: { id, role: "assistant", parts: [{ type: "text", text }] },
    });
  }
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const publisher = createLivePublisher({ deviceId: "device", sessions });
  const first = Promise.withResolvers<unknown>();
  const sent: unknown[] = [];
  const send = async (frame: { payload: string; topic: string }) => {
    const value = JSON.parse(new TextDecoder().decode(await openLive(space, { ...frame, deviceId: "device" })));
    sent.push(...value);
    if (value.some((entry: { sessionId: string }) => entry.sessionId === "small")) first.resolve(sent);
  };
  try {
    publisher.live("large", space, send);
    publisher.live("small", space, send);
    expect(await first.promise).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId: "small", end: true })]),
    );
  } finally {
    publisher.close();
    sessions.remove("large");
    sessions.remove("small");
  }
});

test("a pending streaming timer seals the next preview with the renewed key generation", async () => {
  const sessions = createSessionStore();
  const conversation = await sessions.create("session", inertSessionChannelHooks).conversationReady;
  const message = {
    id: "message",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "After rotation" }],
  };
  conversation.push({ op: "add", path: "/messages/0", value: message });
  const old = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const current = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [
      { generation: 1, secret: "A".repeat(43) },
      { generation: 2, secret: "B".repeat(43) },
    ],
  });
  const publisher = createLivePublisher({ deviceId: "device", sessions });
  const received = Promise.withResolvers<Parameters<Parameters<typeof publisher.live>[2]>[0]>();
  try {
    publisher.live("session", old, received.resolve);
    publisher.live("session", current, received.resolve);
    const frame = await received.promise;
    expect(Buffer.from(frame.payload, "base64").readUInt32BE(1)).toBe(2);
    const clear = JSON.parse(new TextDecoder().decode(await openLive(current, { ...frame, deviceId: "device" })));
    expect(JSON.parse(clear[0].text)).toEqual(message);
  } finally {
    publisher.close();
    sessions.remove("session");
  }
});

test("a closed live receiver ignores an in-flight preview delivered after shutdown", () => {
  const deliveries: unknown[] = [];
  const receiver = createLiveReceiver((_id, _index, message) => deliveries.push(message));
  receiver.close();
  receiver.receive([
    {
      sessionId: "session",
      index: 0,
      version: "version",
      offset: 0,
      end: true,
      text: JSON.stringify({ id: "late", role: "assistant", parts: [{ type: "text", text: "After shutdown" }] }),
    },
  ]);
  expect(deliveries).toEqual([]);
});

test("key renewal during encryption restarts the pending preview without another conversation event", async () => {
  const sessions = createSessionStore();
  const conversation = await sessions.create("session", inertSessionChannelHooks).conversationReady;
  conversation.push({
    op: "add",
    path: "/messages/0",
    value: { id: "message", role: "assistant", parts: [{ type: "text", text: "Final preview" }] },
  });
  const firstKey = { generation: 1, secret: "A".repeat(43) };
  const old = await createSyncSpace({ projectId: "project", spaceOwner: "account", keys: [firstKey] });
  const current = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [firstKey, { generation: 2, secret: "B".repeat(43) }],
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const publisher = createLivePublisher({ deviceId: "device", sessions });
  const received = Promise.withResolvers<Parameters<Parameters<typeof publisher.live>[2]>[0]>();
  try {
    publisher.live(
      "session",
      {
        ...old,
        documentId: async (name) => {
          entered.resolve();
          await release.promise;
          return old.documentId(name);
        },
      },
      received.resolve,
    );
    await entered.promise;
    publisher.prepare(current, received.resolve);
    release.resolve();
    const frame = await received.promise;
    expect(Buffer.from(frame.payload, "base64").readUInt32BE(1)).toBe(2);
    const clear = JSON.parse(new TextDecoder().decode(await openLive(current, { ...frame, deviceId: "device" })));
    expect(clear[0]).toMatchObject({ offset: 0, end: true });
  } finally {
    release.resolve();
    publisher.close();
    sessions.remove("session");
  }
});

test("closing another reader during encryption preserves an already-sent preview's version and offset", async () => {
  const sessions = createSessionStore();
  for (const id of ["large", "closing"]) {
    const conversation = await sessions.create(id, inertSessionChannelHooks).conversationReady;
    conversation.push({
      op: "add",
      path: "/messages/0",
      value: { id, role: "assistant", parts: [{ type: "text", text: "x".repeat(100_000) }] },
    });
  }
  const base = await createSyncSpace({
    projectId: "project",
    spaceOwner: "alice",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let closing = false;
  const space = {
    ...base,
    documentId: async (name: string) => {
      if (name.includes('"closing"')) {
        entered.resolve();
        await release.promise;
      }
      return base.documentId(name);
    },
  };
  const publisher = createLivePublisher({
    deviceId: "device",
    sessions,
    interested: (id) => id !== "closing" || !closing,
  });
  const batches: { version: string; offset: number; text: string }[][] = [];
  const received = Promise.withResolvers<void>();
  const send: Parameters<typeof publisher.live>[2] = (frame) => {
    void openLive(base, { ...frame, deviceId: "device" }).then((bytes) => {
      const frames = JSON.parse(new TextDecoder().decode(bytes));
      if (frames[0]?.sessionId !== "large") return;
      batches.push(frames);
      if (batches.length === 2) received.resolve();
    });
  };
  try {
    publisher.live("large", space, send);
    publisher.live("closing", space, send);
    await entered.promise;
    closing = true;
    release.resolve();
    await received.promise;
    const previous = batches[0]!.at(-1)!;
    expect(batches[1]![0]!.version).toBe(previous.version);
    expect(batches[1]![0]!.offset).toBe(previous.offset + previous.text.length);
  } finally {
    release.resolve();
    publisher.close();
    sessions.remove("large");
    sessions.remove("closing");
  }
});

test("key renewal while sealing another session restarts an earlier partial preview for the renewed reader", async () => {
  const sessions = createSessionStore();
  const message = {
    id: "large",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "x".repeat(100_000) }],
  };
  for (const id of ["large", "rotating"]) {
    const conversation = await sessions.create(id, inertSessionChannelHooks).conversationReady;
    conversation.push({ op: "add", path: "/messages/0", value: { ...message, id } });
  }
  const firstKey = { generation: 1, secret: "A".repeat(43) };
  const old = await createSyncSpace({ projectId: "project", spaceOwner: "alice", keys: [firstKey] });
  const current = await createSyncSpace({
    projectId: "project",
    spaceOwner: "alice",
    keys: [firstKey, { generation: 2, secret: "B".repeat(43) }],
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const first = Promise.withResolvers<{ version: string }>();
  const renewed = Promise.withResolvers<{ version: string; offset: number }>();
  const arrived = Promise.withResolvers<unknown>();
  const receiver = createLiveReceiver((id, _index, received) => {
    if (id === "large") arrived.resolve(received);
  });
  const publisher = createLivePublisher({ deviceId: "device", sessions });
  const space = {
    ...old,
    documentId: async (name: string) => {
      if (name.includes('"rotating"')) {
        entered.resolve();
        await release.promise;
      }
      return old.documentId(name);
    },
  };
  const send: Parameters<typeof publisher.live>[2] = (frame) => {
    void openLive(current, { ...frame, deviceId: "device" }).then((bytes) => {
      const frames = JSON.parse(new TextDecoder().decode(bytes));
      receiver.receive(frames);
      if (frames[0]?.sessionId !== "large") return;
      if (Buffer.from(frame.payload, "base64").readUInt32BE(1) === 1) first.resolve(frames[0]);
      else renewed.resolve(frames[0]);
    });
  };
  try {
    publisher.live("large", space, send);
    publisher.live("rotating", space, send);
    const [initial] = await Promise.all([first.promise, entered.promise]);
    receiver.reset();
    publisher.prepare(current, send);
    release.resolve();
    const next = await renewed.promise;
    expect(next.offset).toBe(0);
    expect(next.version).not.toBe(initial.version);
    expect(await arrived.promise).toEqual(message);
  } finally {
    release.resolve();
    publisher.close();
    receiver.close();
    sessions.remove("large");
    sessions.remove("rotating");
  }
});

test("key renewal between preview ticks restarts every retained partial snapshot", async () => {
  const sessions = createSessionStore();
  const message = {
    id: "message",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "x".repeat(100_000) }],
  };
  const conversation = await sessions.create("session", inertSessionChannelHooks).conversationReady;
  conversation.push({ op: "add", path: "/messages/0", value: message });
  const firstKey = { generation: 1, secret: "A".repeat(43) };
  const old = await createSyncSpace({ projectId: "project", spaceOwner: "alice", keys: [firstKey] });
  const current = await createSyncSpace({
    projectId: "project",
    spaceOwner: "alice",
    keys: [firstKey, { generation: 2, secret: "B".repeat(43) }],
  });
  const first = Promise.withResolvers<{ version: string }>();
  const renewed = Promise.withResolvers<{ version: string; offset: number }>();
  const arrived = Promise.withResolvers<unknown>();
  const receiver = createLiveReceiver((_id, _index, received) => arrived.resolve(received));
  const publisher = createLivePublisher({ deviceId: "device", sessions });
  const send: Parameters<typeof publisher.live>[2] = (frame) => {
    void openLive(current, { ...frame, deviceId: "device" }).then((bytes) => {
      const frames = JSON.parse(new TextDecoder().decode(bytes));
      receiver.receive(frames);
      if (Buffer.from(frame.payload, "base64").readUInt32BE(1) === 1) first.resolve(frames[0]);
      else renewed.resolve(frames[0]);
    });
  };
  try {
    publisher.live("session", old, send);
    const initial = await first.promise;
    // Finish the first send callback and its scheduling microtasks before changing context.
    await new Promise<void>((resolve) => setImmediate(resolve));
    receiver.reset();
    publisher.prepare(current, send);
    const next = await renewed.promise;
    expect(next.offset).toBe(0);
    expect(next.version).not.toBe(initial.version);
    expect(await arrived.promise).toEqual(message);
  } finally {
    publisher.close();
    receiver.close();
    sessions.remove("session");
  }
});
