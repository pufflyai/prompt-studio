import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { createMessageAccumulator } from "./message-accumulator";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { getClaudeForkMessageId, normalizeClaudeCodeMessages } from "./normalize-transcript";

test("a completed live reply keeps its native identity through history recovery and fork selection", async () => {
  const entries = [
    {
      type: "assistant",
      uuid: "first",
      message: { role: "assistant", content: [{ type: "text" as const, text: "First half." }] },
    },
    {
      type: "assistant",
      uuid: "last",
      message: { role: "assistant", content: [{ type: "text" as const, text: "Second half." }] },
    },
  ];
  const messages: SessionMessage[] = [];
  const accumulator = createMessageAccumulator({
    getMessages: () => messages,
    push: (patch) => {
      messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
    },
  });
  async function* events() {
    for (const entry of entries) yield { type: "stdout" as const, data: JSON.stringify(entry) };
  }
  for await (const message of normalizeClaudeCodeStream(events())) accumulator.push(message);
  const native = normalizeClaudeCodeMessages(entries);
  expect(messages.map((message) => message.id)).toEqual(native.map((message) => message.id));
  expect(getClaudeForkMessageId(entries, messages[0].id)).toBe("last");
});
