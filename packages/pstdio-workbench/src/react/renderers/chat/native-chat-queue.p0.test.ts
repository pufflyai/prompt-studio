import { expect, test } from "bun:test";
import { chatRendererActionSchema } from "pstdio-api-contracts";
import { queuedChatDraft } from "./native-chat-queue";

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
