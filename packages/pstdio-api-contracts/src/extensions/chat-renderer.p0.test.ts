import { expect, test } from "bun:test";
import type { ChatRendererContribution } from "../extension-kernel/types/chat-renderer";
import { chatRendererEventSchema, chatRendererSnapshotSchema } from "./chat-renderer";
import { type WorkbenchExtensionViewBody, workbenchExtensionViewRecordSchema } from "./workbench-metadata";

test("queue steering capability can be restored independently of individual requests", () => {
  const blocked = chatRendererSnapshotSchema.parse({ queueSteeringUnavailableReason: "Harness cannot steer" });
  expect(blocked.queueSteeringUnavailableReason).toBe("Harness cannot steer");
  const restored = chatRendererSnapshotSchema.parse({
    queueSteeringUnavailableReason: null,
    queuedFollowUps: [{ id: "q", prompt: "Next", steeringUnavailableReason: "Delivery pending" }],
  });
  expect(restored.queueSteeringUnavailableReason).toBeNull();
  expect(restored.queuedFollowUps?.[0]?.steeringUnavailableReason).toBe("Delivery pending");
});

test("side-effect-only action handlers need no return value", async () => {
  const perform = async () => {};
  const onAction: ChatRendererContribution["onAction"] = perform;
  expect(await onAction({} as never, {} as never)).toBeUndefined();
});

test("native chat metadata carries static composer state and qualified handlers without executable entries", () => {
  const body: WorkbenchExtensionViewBody = {
    kind: "chat",
    draftKey: "new-conversation",
    initial: { messages: [], controls: [], values: {}, readOnly: false },
    queryHandlerId: "acme.chat.view.conversation.chat.query",
    actionHandlerId: "acme.chat.view.conversation.chat.onAction",
    stream: { kind: "command", extensionId: "acme.chat", id: "watch" },
  };
  const parsed = workbenchExtensionViewRecordSchema.parse({
    id: "acme.chat.view.conversation",
    localId: "conversation",
    extensionId: "acme.chat",
    title: "Conversation",
    body,
  });
  expect(parsed.body).toEqual(body);
});

test("message patches require a value matching the target and operation", () => {
  const message = { id: "m", role: "assistant", parts: [{ type: "text", text: "Hi" }] };
  const valid = (patch: unknown) => chatRendererEventSchema.safeParse({ revision: 0, patch }).success;
  expect(valid({ op: "replace", path: "/messages", value: [message] })).toBe(true);
  expect(valid({ op: "add", path: "/messages/0", value: message })).toBe(true);
  expect(valid({ op: "remove", path: "/messages/0" })).toBe(true);
  expect(valid({ op: "replace", path: "/messages", value: message })).toBe(false);
  expect(valid({ op: "replace", path: "/messages/0", value: [message] })).toBe(false);
  expect(valid({ op: "add", path: "/messages/0" })).toBe(false);
  expect(valid({ op: "remove", path: "/messages" })).toBe(false);
});

test("chat snapshots use canonical messages and reject malformed controls and messages", () => {
  expect(
    chatRendererSnapshotSchema.safeParse({
      messages: [{ id: "m", role: "assistant", parts: [{ type: "text", text: "Hello" }] }],
    }).success,
  ).toBe(true);
  expect(chatRendererSnapshotSchema.safeParse({ messages: [{ id: "m", role: "invented", parts: [] }] }).success).toBe(
    false,
  );
  expect(chatRendererSnapshotSchema.safeParse({ controls: [{ type: "selection", id: "model" }] }).success).toBe(false);
});
