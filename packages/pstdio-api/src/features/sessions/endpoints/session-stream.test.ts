import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openSessionStreamConnection } from "../../../test-utils/session-stream";
import { inertSessionChannelHooks } from "../session-store.test-utils";

type Envelope = { subscription_id: string; data: { path?: string; value?: Array<{ id: string }> } };

const startSession = async (
  handle: Awaited<ReturnType<typeof createTestApp>>,
  projectId: string,
  messageId: string,
) => {
  const session = await handle.deps.sessionService.create({ project_id: projectId, title: messageId, agent: "test" });
  const entry = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
  const conversation = await entry.conversationReady;
  conversation.push({
    op: "replace",
    path: "/messages",
    value: [{ id: messageId, role: "user", parts: [{ type: "text", text: messageId }] }],
  });
  return { session, conversation };
};

test("one session stream carries the events of several sessions", async () => {
  const handle = await createTestApp();
  const project = await handle.deps.projectService.create({ name: "Shared session stream" });
  const first = await startSession(handle, project.id, "first-message");
  const second = await startSession(handle, project.id, "second-message");
  const connection = await openSessionStreamConnection(handle.app);
  try {
    expect((await connection.subscribe("a", first.session.id)).status).toBe(204);
    expect((await connection.subscribe("b", second.session.id)).status).toBe(204);
    const snapshots = new Map<string, string[]>();
    while (snapshots.size < 2) {
      const event = await connection.next();
      if (!event) throw new Error("Session stream closed");
      if (event.event !== "patch") continue;
      const envelope = JSON.parse(event.data) as Envelope;
      if (envelope.data.path === "/messages") {
        snapshots.set(
          envelope.subscription_id,
          envelope.data.value!.map((message) => message.id),
        );
      }
    }
    expect(snapshots.get("a")).toEqual(["first-message"]);
    expect(snapshots.get("b")).toEqual(["second-message"]);
    const removed = await handle.app.request(`/v1/session-stream/${connection.connectionId}/subscriptions/a`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(204);
  } finally {
    await connection.close();
    first.conversation.close();
    second.conversation.close();
    await handle.close();
  }
});

test("subscribing on a closed session stream is rejected", async () => {
  const handle = await createTestApp();
  try {
    const response = await handle.app.request("/v1/session-stream/closed-stream/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription_id: "a", session_id: "any-session" }),
    });
    expect(response.status).toBe(404);
  } finally {
    await handle.close();
  }
});
