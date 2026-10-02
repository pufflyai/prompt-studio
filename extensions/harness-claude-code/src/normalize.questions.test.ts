import { describe, expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/sdk/extensions";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import type { ClaudeCodeTranscriptEntry, RawLogEvent } from "./types";

const askInput = {
  questions: [
    {
      question: "Red or blue?",
      header: "Color",
      options: [
        { label: "Red", description: "Warm" },
        { label: "Blue", description: "Cool" },
      ],
      multiSelect: true,
    },
  ],
};

// The neutral shape the chat question form reads. `custom` offers Other, which Claude accepts.
const questionInput = {
  questions: [
    {
      question: "Red or blue?",
      header: "Color",
      options: [
        { label: "Red", description: "Warm" },
        { label: "Blue", description: "Cool" },
      ],
      multiple: true,
      custom: true,
    },
  ],
};

const answeredText = 'The user answered: "Red or blue?"="Teal, actually". Read the answers carefully.';
const skippedText = "The user skipped this question without answering. Continue without an answer.";

const askToolUse = { type: "tool_use" as const, id: "toolu_q", name: "AskUserQuestion", input: askInput };

const stdout = (data: object): RawLogEvent => ({ type: "stdout", data: JSON.stringify(data) });

const collectStream = async (events: RawLogEvent[]) => {
  async function* source() {
    yield* events;
  }
  const messages: SessionMessage[] = [];
  for await (const message of normalizeClaudeCodeStream(source())) messages.push(message);
  return messages;
};

const toolResultEvent = (content: string, isError = false) =>
  stdout({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_q", content, is_error: isError }] },
    tool_use_result: { ...askInput, answers: { "Red or blue?": "Teal, actually" } },
  });

const transcriptEntry = (
  uuid: string,
  role: string,
  content: ClaudeCodeTranscriptEntry["message"]["content"],
  toolUseResult?: unknown,
): ClaudeCodeTranscriptEntry => ({ uuid, type: role, message: { role, content }, toolUseResult });

describe("Claude questions in the chat", () => {
  test("the live stream shows AskUserQuestion as the chat question form", async () => {
    const [message] = await collectStream([
      stdout({ type: "assistant", message: { role: "assistant", content: [askToolUse] } }),
    ]);

    expect(message.parts[0]).toEqual({
      type: "tool",
      tool: "question",
      callId: "toolu_q",
      actionType: "other",
      status: "pending",
      state: { input: questionInput },
    });
  });

  test("the live stream closes the form with Claude's answer text", async () => {
    const messages = await collectStream([
      stdout({ type: "assistant", message: { role: "assistant", content: [askToolUse] } }),
      toolResultEvent(answeredText),
    ]);

    expect(messages[1].parts[0]).toMatchObject({
      tool: "question",
      callId: "toolu_q",
      status: "completed",
      state: { output: answeredText },
    });
  });

  test("a reloaded chat shows the same question, answered", () => {
    const [message] = normalizeClaudeCodeMessages([
      transcriptEntry("a1", "assistant", [askToolUse]),
      transcriptEntry("u1", "user", [{ type: "tool_result", tool_use_id: "toolu_q", content: answeredText }], {
        ...askInput,
        answers: { "Red or blue?": "Teal, actually" },
      }),
    ]);

    expect(message.parts[0]).toEqual({
      type: "tool",
      tool: "question",
      callId: "toolu_q",
      actionType: "other",
      status: "completed",
      state: { input: questionInput, output: answeredText },
    });
  });

  test("a skipped question shows Claude's own note instead of a generic tool failure", () => {
    const [message] = normalizeClaudeCodeMessages([
      transcriptEntry("a1", "assistant", [askToolUse]),
      transcriptEntry(
        "u1",
        "user",
        [{ type: "tool_result", tool_use_id: "toolu_q", content: skippedText, is_error: true }],
        `Error: ${skippedText}`,
      ),
    ]);

    expect(message.parts[0]).toMatchObject({
      tool: "question",
      status: "failed",
      state: { output: skippedText, errorText: skippedText },
    });
  });
});

describe("malformed questions", () => {
  test("a malformed question list does not stop the live stream or transcript reload", async () => {
    const malformed = { ...askToolUse, input: { questions: [null] } };
    const messages = await collectStream([
      stdout({ type: "assistant", message: { role: "assistant", content: [malformed] } }),
      toolResultEvent("The question input is invalid.", true),
    ]);

    expect(messages[0].parts[0]).toMatchObject({ tool: "question", state: { input: malformed.input } });
    expect(messages[1].parts[0]).toMatchObject({ tool: "question", status: "failed" });
    const [reloaded] = normalizeClaudeCodeMessages([
      transcriptEntry("a1", "assistant", [malformed]),
      transcriptEntry("u1", "user", [
        { type: "tool_result", tool_use_id: "toolu_q", content: "The question input is invalid.", is_error: true },
      ]),
    ]);
    expect(reloaded.parts[0]).toMatchObject({
      tool: "question",
      status: "failed",
      state: { input: malformed.input },
    });
  });

  test("a malformed question from Claude does not break the chat", async () => {
    const malformed = { ...askToolUse, input: { questions: JSON.stringify(askInput.questions) } };
    const [message] = await collectStream([
      stdout({ type: "assistant", message: { role: "assistant", content: [malformed] } }),
    ]);

    expect(message.parts[0]).toMatchObject({ tool: "question", state: { input: malformed.input } });
    expect(normalizeClaudeCodeMessages([transcriptEntry("a1", "assistant", [malformed])])[0].parts[0]).toMatchObject({
      tool: "question",
      status: "pending",
    });
  });
});

describe("live tool results", () => {
  test("a tool result reaches the chat while the run is still going", async () => {
    const messages = await collectStream([
      stdout({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_bash", name: "Bash", input: {} }] },
      }),
      stdout({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_bash", content: "exit 2", is_error: true }],
        },
        tool_use_result: "Error: exit 2",
      }),
      stdout({
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_read", content: "file" }] },
        tool_use_result: { type: "text", file: { filePath: "/a.ts" } },
      }),
    ]);

    expect(messages.slice(1).map((message) => message.parts[0])).toEqual([
      {
        type: "tool",
        tool: "Bash",
        callId: "toolu_bash",
        actionType: "execute",
        status: "failed",
        state: { output: "exit 2", errorText: "Tool execution failed" },
      },
      {
        type: "tool",
        tool: "unknown",
        callId: "toolu_read",
        actionType: "other",
        status: "completed",
        state: { output: { type: "text", file: { filePath: "/a.ts" }, returnDisplay: "file" } },
      },
    ]);
  });

  test("ignores the person's own text that Claude echoes back", async () => {
    const messages = await collectStream([
      stdout({ type: "user", message: { role: "user", content: [{ type: "text", text: "Hello" }] } }),
      stdout({ type: "user", message: { role: "user", content: "Hello" } }),
    ]);

    expect(messages).toEqual([]);
  });
});
