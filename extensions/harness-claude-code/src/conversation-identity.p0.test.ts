import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { recoverClaudeMessages } from "./history-reconciliation";
import { createMessageAccumulator } from "./message-accumulator";
import { recordingSink } from "./mocks/controlled-child";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import type { ClaudeCodeTranscriptEntry, RawLogEvent } from "./types";

async function* events(entries: object[]): AsyncIterable<RawLogEvent> {
  for (const entry of entries) yield { type: "stdout", data: JSON.stringify(entry) };
}

test("recovering a skill invocation keeps one user turn and one copy of each response", async () => {
  const user: SessionMessage = { id: "prompt", role: "user", parts: [{ type: "text", text: "Draw a diagram." }] };
  const skill = {
    uuid: "skill-instructions",
    type: "user",
    isMeta: true,
    sourceToolUseID: "skill-call",
    message: {
      role: "user",
      content: [{ type: "text" as const, text: "Base directory for this skill: /skills/diagram" }],
    },
  };
  const entries: ClaudeCodeTranscriptEntry[] = [
    { uuid: user.id, type: "user", message: { role: "user", content: "Draw a diagram." } },
    {
      uuid: "skill-use",
      type: "assistant",
      message: { role: "assistant", content: [{ type: "tool_use", id: "skill-call", name: "Skill", input: {} }] },
    },
    skill,
    {
      uuid: "skill-result",
      type: "user",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "skill-call", content: "Loaded." }] },
    },
    {
      uuid: "reply",
      type: "assistant",
      message: { role: "assistant", content: [{ type: "text", text: "Diagram ready." }] },
    },
  ];
  const { sink, messages } = recordingSink();
  const accumulator = createMessageAccumulator(sink, { initialMessages: [user], pushInitialMessages: true });
  for await (const message of normalizeClaudeCodeStream(events(entries))) accumulator.push(message);
  const nativeMessages = normalizeClaudeCodeMessages(entries);
  const recovered = recoverClaudeMessages({ knownMessages: messages, nativeMessages });

  expect(nativeMessages.filter((message) => message.role === "user").map((message) => message.id)).toEqual([user.id]);
  expect(recovered.kind).toBe("recovered");
  if (recovered.kind !== "recovered") throw new Error(recovered.category);
  expect(recovered.messages.map((message) => message.id)).toEqual(nativeMessages.map((message) => message.id));
  expect(recovered.messages.filter((message) => message.id === "reply-0")).toHaveLength(1);
});

test("generated message identities stay unique across follow-up runs", async () => {
  const { sink, messages } = recordingSink();
  for (const callId of ["first-call", "follow-up-call"]) {
    const accumulator = createMessageAccumulator(sink, { indexOffset: messages.length });
    const stream = events([
      { type: "assistant", message: { content: [{ type: "tool_use", id: callId, name: "Read", input: {} }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: callId, content: "Read." }] } },
      { type: "assistant", message: { content: [{ type: "text", text: "Done." }] } },
      { type: "result", usage: { input_tokens: 1, output_tokens: 1 } },
    ]);
    for await (const message of normalizeClaudeCodeStream(stream)) accumulator.push(message);
  }

  expect(messages).toHaveLength(6);
  expect(new Set(messages.map((message) => message.id)).size).toBe(messages.length);
  expect(
    messages.filter((message) => message.parts[0]?.type === "tool").map((message) => message.parts[0]),
  ).toMatchObject([
    { callId: "first-call", status: "completed" },
    { callId: "follow-up-call", status: "completed" },
  ]);
});

test("meta context is excluded in both text forms while genuine submissions keep their identity", () => {
  const entries = [
    { uuid: "string-context", type: "user", isMeta: true, message: { role: "user", content: "Skill context" } },
    {
      uuid: "array-context",
      type: "user",
      isMeta: true,
      message: { role: "user", content: [{ type: "text" as const, text: "Skill context" }] },
    },
    {
      uuid: "real-submission",
      type: "user",
      isMeta: false,
      message: { role: "user", content: "Base directory for this skill: show this as my input." },
    },
  ];

  expect(normalizeClaudeCodeMessages(entries)).toMatchObject([{ id: "real-submission", role: "user" }]);
});
