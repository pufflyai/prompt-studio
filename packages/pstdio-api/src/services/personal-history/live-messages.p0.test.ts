import { expect, test } from "bun:test";
import { createSyncSpace, openLive } from "pstdio-sync";
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

test("a large streaming snapshot leaves room for another session in the first live frame", async () => {
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
  const send = async (frame: { payload: string }) =>
    first.resolve(JSON.parse(new TextDecoder().decode(await openLive(space, { ...frame, deviceId: "device" }))));
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
