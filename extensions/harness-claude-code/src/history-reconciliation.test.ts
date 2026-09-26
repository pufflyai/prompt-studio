import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { recoverClaudeMessages } from "./history-reconciliation";
import { createMessageAccumulator } from "./message-accumulator";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import type { ClaudeCodeTranscriptEntry, RawLogEvent } from "./types";

test("actual Claude transcript tool results merge with live normalization and retain rich native output", async () => {
  const entries = (await Bun.file(new URL("./mocks/tool-calls-transcript.jsonl", import.meta.url)).text())
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ClaudeCodeTranscriptEntry);
  const nativeMessages = normalizeClaudeCodeMessages(entries);
  const knownMessages: SessionMessage[] = [];
  const accumulator = createMessageAccumulator({
    getMessages: () => knownMessages,
    push: (patch) => {
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "add") knownMessages.splice(index, 0, patch.value as SessionMessage);
      else knownMessages[index] = patch.value as SessionMessage;
    },
  });
  async function* stream(): AsyncIterable<RawLogEvent> {
    for (const entry of entries) {
      yield {
        type: "stdout",
        data: JSON.stringify({ type: "assistant", message: entry.message, timestamp: entry.timestamp }),
      };
    }
  }
  for await (const message of normalizeClaudeCodeStream(stream())) accumulator.push(message);
  expect(recoverClaudeMessages({ knownMessages, nativeMessages })).toEqual({
    kind: "recovered",
    messages: nativeMessages,
  });
});
