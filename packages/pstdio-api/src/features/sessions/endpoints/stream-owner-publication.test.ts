import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

test("a resumed stream waits for its owner after the run status is published", async () => {
  const handle = await createTestApp();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const project = await handle.deps.projectService.create({ name: "Owner publication" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Resuming",
      agent: "test",
    });
    await handle.deps.sessionService.update(session.id, { agent_session_id: "existing-thread" });
    const response = await handle.app.request(`/v1/sessions/${session.id}/stream`);
    reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("event: heartbeat") && !text.includes("event: end")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    expect(text).not.toContain("event: end");
    const entry = handle.deps.sessionService.store.create(session.id, () => {});
    const conversation = await entry.conversationReady;
    conversation.push({
      op: "replace",
      path: "/messages",
      value: [{ id: "restored", role: "user", parts: [{ type: "text", text: "Earlier turn" }] }],
    });
    while (!text.includes('"restored"')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    expect(text).toContain('"restored"');
    expect(text).not.toContain("event: end");
  } finally {
    await reader?.cancel();
    await handle.close();
  }
});
