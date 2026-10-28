import { expect, test } from "bun:test";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
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
  const sink = {
    getMessages: () => knownMessages,
    push: (patch: JsonPatch) => {
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "add") knownMessages.splice(index, 0, patch.value as SessionMessage);
      else knownMessages[index] = patch.value as SessionMessage;
    },
  };
  const accumulator = createMessageAccumulator(sink);
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

test("plan review keeps its Markdown preview when native history omits the approval context", async () => {
  const { toolUsePart } = await import("./message-parts");
  const call = { type: "tool_use" as const, id: "plan", name: "ExitPlanMode", input: {} };
  const preview: SessionMessage = {
    id: "stream-plan-plan",
    role: "assistant",
    parts: [{ type: "text", text: "# Plan\n\nAdd a greeting." }],
  };
  const known: SessionMessage = {
    id: "live-plan",
    role: "assistant",
    parts: [
      { ...toolUsePart(call), status: "completed", state: { ...toolUsePart(call).state, output: "Plan approved." } },
    ],
  };
  const nativeMessages = normalizeClaudeCodeMessages([
    { uuid: "a", type: "assistant", message: { role: "assistant", content: [call] } },
    {
      uuid: "b",
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: "Plan approved." }] },
    },
  ]);
  const result = recoverClaudeMessages({ knownMessages: [known, preview], nativeMessages });
  expect(result.kind).toBe("recovered");
  if (result.kind === "recovered") {
    expect(result.messages.flatMap((message) => message.parts)).toContainEqual(preview.parts[0]);
    expect(result.messages.flatMap((message) => message.parts).filter((part) => part.type === "tool")).toHaveLength(1);
  }
});
