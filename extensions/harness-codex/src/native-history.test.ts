import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { nativeItemMessage, nativeThreadMessages, recoverNativeHistory } from "./native-history";

test("live and snapshot native items use the same turn and item identity", () => {
  const item = { type: "agentMessage", id: "answer", text: "hello" } as Parameters<typeof nativeItemMessage>[0];
  expect(nativeItemMessage(item, "one")?.id).toBe("codex-one-answer");
  expect(nativeItemMessage(item, "two")?.id).toBe("codex-two-answer");
});
test("native refresh is idempotent and preserves attachments and messages removed by compaction", () => {
  const known: SessionMessage[] = [
    {
      id: "codex-one-user",
      role: "user",
      parts: [
        { type: "text", text: "hello" },
        { type: "file", fileId: "f", filename: "notes.txt", url: "/f" },
      ],
    },
    { id: "codex-one-answer", role: "assistant", parts: [{ type: "text", text: "reply" }] },
  ];
  const native: SessionMessage[] = [
    { id: "codex-one-user", role: "user", parts: [{ type: "text", text: "hello" }] },
    { id: "codex-two-answer", role: "assistant", parts: [{ type: "text", text: "new" }] },
  ];
  const result = recoverNativeHistory({ knownMessages: known, nativeMessages: native });
  expect(result.messages).toHaveLength(3);
  expect(result.messages[0].parts[1]).toMatchObject({ fileId: "f" });
  expect(recoverNativeHistory({ knownMessages: result.messages, nativeMessages: native })).toEqual(result);
});
test("legacy checkpoints retain repeated prompts once and adopt only subsequent native turns", () => {
  const known: SessionMessage[] = [
    { id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] },
    { id: "codex-0-item_1", role: "assistant", parts: [{ type: "text", text: "hello" }] },
  ];
  const native: SessionMessage[] = [
    { id: "codex-old-user", role: "user", parts: [{ type: "text", text: "hello" }] },
    { id: "codex-old-answer", role: "assistant", parts: [{ type: "text", text: "hello" }] },
    { id: "codex-next-user", role: "user", parts: [{ type: "text", text: "hello" }] },
    { id: "codex-next-answer", role: "assistant", parts: [{ type: "text", text: "hello" }] },
  ];
  const result = recoverNativeHistory({ knownMessages: known, nativeMessages: native });
  expect(result.messages.map((m) => m.id)).toEqual([
    "user-1",
    "codex-0-item_1",
    "codex-next-user",
    "codex-next-answer",
  ]);
  expect(recoverNativeHistory({ knownMessages: result.messages, nativeMessages: native })).toEqual(result);
});

test("recovery inserts missing native items before their saved successor", () => {
  const user: SessionMessage = { id: "codex-turn-user", role: "user", parts: [{ type: "text", text: "work" }] };
  const answer: SessionMessage = {
    id: "codex-turn-answer",
    role: "assistant",
    parts: [{ type: "text", text: "done" }],
  };
  const tool: SessionMessage = { id: "codex-turn-tool", role: "assistant", parts: [{ type: "text", text: "tool" }] };
  expect(
    recoverNativeHistory({ knownMessages: [user, answer], nativeMessages: [user, tool, answer] }).messages.map(
      (m) => m.id,
    ),
  ).toEqual([user.id, tool.id, answer.id]);
});
test("native history restores a failed turn even without an item checkpoint", () => {
  const turns: Parameters<typeof nativeThreadMessages>[0] = [
    {
      id: "failed",
      status: "failed",
      items: [],
      error: { message: "Native failure", codexErrorInfo: null, additionalDetails: null, misalignment: null },
      startedAt: 2,
      completedAt: 3,
      durationMs: 1000,
      itemsView: "full",
    },
  ];
  expect(nativeThreadMessages(turns)).toMatchObject([
    { id: "codex-failed-error", parts: [{ type: "error", message: "Native failure" }] },
  ]);
});
