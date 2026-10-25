import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openSessionStreamConnection } from "../../../test-utils/session-stream";
import { inertSessionChannelHooks } from "../session-store.test-utils";

type QueuedMessagesEvent = { messages: { id: string }[] };

const openQueueStream = async (live: boolean) => {
  const handle = await createTestApp();
  const project = await handle.deps.projectService.create({ name: "Queue changes" });
  const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Busy", agent: "test" });
  await handle.deps.sessionService.transitionStatus(session.id, "in_progress");
  const entry = live ? handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks) : undefined;
  const connection = await openSessionStreamConnection(handle.app);
  await connection.subscribe("queue", session.id);
  const next = async () => {
    while (true) {
      const event = await connection.next();
      if (!event) throw new Error("The session stream closed");
      if (event.event !== "heartbeat") return { event: event.event, data: JSON.parse(event.data).data };
    }
  };
  return {
    queue: handle.deps.sessionQueueEntriesService,
    sessionId: session.id,
    next,
    nextQueue: async () => {
      while (true) {
        const event = await next();
        if (event.event === "queued_messages") return event.data as QueuedMessagesEvent;
      }
    },
    close: async () => {
      await connection.close();
      (await entry?.conversationReady)?.close();
      await handle.close();
    },
  };
};

test.each([
  ["while it waits for a run", false],
  ["during a live run", true],
])("the session stream publishes each queue change %s", async (_label, live) => {
  const stream = await openQueueStream(live);
  try {
    expect((await stream.next()).event).toBe("ready");
    if (live) expect((await stream.nextQueue()).messages).toEqual([]);
    const saved = await stream.queue.create({
      session_id: stream.sessionId,
      request_kind: "follow_up",
      prompt: "Wait",
    });
    const queuedId = `queued-prompt-${stream.sessionId}-${saved.queue_position}`;
    expect((await stream.nextQueue()).messages.map((message) => message.id)).toEqual([queuedId]);
    await stream.queue.removePending(saved.queue_position, saved.revision);
    expect((await stream.nextQueue()).messages).toEqual([]);
  } finally {
    await stream.close();
  }
});
