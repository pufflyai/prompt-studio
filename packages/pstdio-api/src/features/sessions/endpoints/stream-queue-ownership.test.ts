import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

test("stream snapshots separate a confirmed prompt from an identical pending prompt", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Queue ownership" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Repeated",
      agent: "test",
    });
    const queue = handle.deps.sessionQueueEntriesService;
    const first = await queue.create({ session_id: session.id, request_kind: "follow_up", prompt: "repeat" });
    const second = await queue.create({ session_id: session.id, request_kind: "follow_up", prompt: "repeat" });
    await queue.markDispatchStarted(first.queue_position);
    const entry = handle.deps.sessionService.store.create(session.id, () => {});
    const conversation = await entry.conversationReady;
    conversation.push({
      op: "replace",
      path: "/messages",
      value: [{ id: "confirmed", role: "user", parts: [{ type: "text", text: "repeat" }] }],
    });
    const response = await handle.app.request(`/v1/sessions/${session.id}/stream`);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      while (!text.includes("event: patch")) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error("No snapshot");
        text += decoder.decode(chunk.value, { stream: true });
      }
      const events = text
        .split("\n\n")
        .filter(Boolean)
        .map((block) => ({
          event: block
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.slice(7),
          data: JSON.parse(
            block
              .split("\n")
              .find((line) => line.startsWith("data:"))!
              .slice(6),
          ),
        }));
      expect(events.map((event) => event.event)).toEqual(["ready", "queued_messages", "patch"]);
      expect(events[1].data.messages.map((message: { id: string }) => message.id)).toEqual([
        `queued-prompt-${session.id}-${second.queue_position}`,
      ]);
      expect(events[2].data.value.map((message: { id: string }) => message.id)).toEqual(["confirmed"]);
    } finally {
      await reader.cancel();
      conversation.close();
    }
  } finally {
    await handle.close();
  }
});
