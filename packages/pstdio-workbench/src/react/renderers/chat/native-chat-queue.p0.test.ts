import { expect, test } from "bun:test";
import { chatRendererActionSchema } from "pstdio-api-contracts";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { runNativeChatAction } from "./native-chat-action";
import { queuedChatDraft } from "./native-chat-queue";

test("a live steering capability refresh clears a prior block but preserves per-request restrictions", () => {
  const session = createChatSession({
    initial: { queueSteeringUnavailableReason: "Harness cannot steer" },
    query: async () => ({}),
    action: async () => undefined,
  });
  expect(session.getSnapshot().conversation.queueSteeringUnavailableReason).toBe("Harness cannot steer");
  session.accept({
    revision: 1,
    snapshot: {
      queueSteeringUnavailableReason: null,
      queuedFollowUps: [{ id: "q", prompt: "Next", steeringUnavailableReason: "Delivery pending" }],
    },
  });
  expect(session.getSnapshot().conversation.queueSteeringUnavailableReason).toBeNull();
  expect(session.getSnapshot().queuedFollowUps[0]?.steeringUnavailableReason).toBe("Delivery pending");
});

test("queued control echoes update presentation without replacing query-derived base settings", async () => {
  const base = { provider: { harnessId: "test.agent", model: "A", params: { thinking: "A" } } };
  const queued = { provider: { harnessId: "test.agent", model: "B", params: { thinking: "low" } } };
  const session = createChatSession({ query: async () => ({ values: base }), action: async () => undefined });
  const release = session.retain();
  await session.query.read();
  expect(session.getSnapshot().draft.values).toEqual(base);
  const act = async () => ({ snapshot: { values: queued, notice: "Queue settings checked" } });
  await runNativeChatAction(session, { type: "control", id: "provider", values: queued }, act, true);
  expect(session.getSnapshot().draft.values).toEqual(base);
  expect(session.getSnapshot().conversation.notice).toBe("Queue settings checked");
  await runNativeChatAction(session, { type: "control", id: "provider", values: queued }, act, false);
  expect(session.getSnapshot().draft.values).toEqual(queued);
  release();
});

test("native queue editing and create-as-new preserve queued model and params instead of the active harness settings", () => {
  const active = {
    text: "Unsent",
    attachments: [],
    values: { provider: { harnessId: "test.agent", model: "A", params: { thinking: "A" } }, workspace: "ws" },
  };
  const item = {
    id: "queued",
    prompt: "Original",
    model: "B",
    values: { provider: { harnessId: "test.agent", model: "B", params: { thinking: "B" } } },
    params: { thinking: "B" },
    revision: "saved",
    attachments: [{ id: "file", name: "note.txt" }],
  };
  const edit = queuedChatDraft(active, item);
  for (const operation of ["update", "create"] as const) {
    const action = chatRendererActionSchema.parse({
      type: "queue",
      operation,
      item,
      prompt: "Prompt edit only",
      ...edit,
    });
    expect(action).toMatchObject({
      values: { provider: { harnessId: "test.agent", model: "B", params: { thinking: "B" } }, workspace: "ws" },
      attachments: item.attachments,
      item: { revision: "saved" },
    });
  }
  expect(active.values.provider.model).toBe("A");
});

test("a queue entry without a model never inherits a different active model or parameter", () => {
  expect(
    queuedChatDraft(
      {
        text: "",
        attachments: [],
        values: { provider: { harnessId: "test.agent", model: "A", params: { thinking: "A" } } },
      },
      {
        id: "q",
        prompt: "Queued",
        model: null,
        params: {},
        values: { provider: { harnessId: "test.agent", params: {} } },
      },
    ).values,
  ).toEqual({ provider: { harnessId: "test.agent", params: {} } });
});
