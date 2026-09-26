import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

test("queued messages read only pending prompts and follow edits, reorder, claim and removal", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "queue" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "queue",
      agent: "unavailable",
    });
    const queue = handle.deps.sessionQueueEntriesService;
    const changes: unknown[] = [];
    const unsubscribe = handle.eventBus.subscribe((event) => {
      if (event.table === "sessions") changes.push(event.data);
    });
    const notified = async <T>(mutation: () => Promise<T>) => {
      const before = changes.length;
      const result = await mutation();
      expect(changes.length).toBeGreaterThan(before);
      expect(changes.at(-1)).toMatchObject({ id: session.id });
      return result;
    };
    const first = await notified(() =>
      queue.create({ session_id: session.id, request_kind: "follow_up", prompt: "first" }),
    );
    const second = await notified(() =>
      queue.create({ session_id: session.id, request_kind: "start", prompt: "second" }),
    );
    const read = async () => {
      const response = await handle.app.request(`/v1/sessions/${session.id}/queued-messages`);
      expect(response.status).toBe(200);
      return (await response.json()).messages;
    };
    expect((await read()).map((message: { parts: { text: string }[] }) => message.parts[0].text)).toEqual([
      "first",
      "second",
    ]);
    await notified(() => queue.updatePending(first.queue_position, { prompt: "edited" }));
    await notified(() =>
      queue.swapPending(first.queue_position, { prompt: "second" }, second.queue_position, { prompt: "edited" }),
    );
    expect((await read()).map((message: { parts: { text: string }[] }) => message.parts[0].text)).toEqual([
      "second",
      "edited",
    ]);
    await notified(() => queue.markDispatchStarted(first.queue_position));
    expect(await read()).toEqual([
      {
        id: `queued-prompt-${session.id}-${second.queue_position}`,
        role: "user",
        parts: [{ type: "text", text: "edited" }],
      },
    ]);
    await notified(() => queue.removePending(second.queue_position));
    expect(await read()).toEqual([]);
    await notified(() =>
      handle.deps.sessionService.insertEntryForActive({ id: session.id, request_kind: "follow_up", prompt: "remote" }),
    );
    await notified(() => queue.remove(first.queue_position));
    await notified(() => queue.removeBySession(session.id));
    unsubscribe();
  } finally {
    await handle.close();
  }
});
