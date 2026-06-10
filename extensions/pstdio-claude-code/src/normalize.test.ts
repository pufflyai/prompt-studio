import { describe, expect, test } from "bun:test";
import { normalizeClaudeCodeStream } from "./normalize-stream";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import type { ClaudeCodeTranscriptEntry, RawLogEvent } from "./types";

// --- Helper ---

const entry = (
  uuid: string,
  role: string,
  content: ClaudeCodeTranscriptEntry["message"]["content"],
): ClaudeCodeTranscriptEntry => ({
  uuid,
  type: "message",
  message: { role, content },
});

async function* toAsync(events: RawLogEvent[]): AsyncIterable<RawLogEvent> {
  for (const e of events) yield e;
}

const collect = async (stream: AsyncIterable<unknown>) => {
  const result: unknown[] = [];
  for await (const item of stream) result.push(item);
  return result;
};

const stdout = (data: object): RawLogEvent => ({ type: "stdout", data: JSON.stringify(data) });

// --- normalizeClaudeCodeMessages ---

describe("normalizeClaudeCodeMessages", () => {
  test("normalizes a string content entry", () => {
    const result = normalizeClaudeCodeMessages([entry("u1", "user", "hello")]);

    expect(result).toEqual([{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }], index: 0 }]);
  });

  test("skips empty string content", () => {
    const result = normalizeClaudeCodeMessages([entry("u1", "user", "   ")]);

    expect(result).toEqual([]);
  });

  test("normalizes text content blocks", () => {
    const result = normalizeClaudeCodeMessages([entry("a1", "assistant", [{ type: "text", text: "hi" }])]);

    expect(result).toEqual([{ id: "a1-0", role: "assistant", parts: [{ type: "text", text: "hi" }], index: 0 }]);
  });

  test("skips empty text blocks", () => {
    const result = normalizeClaudeCodeMessages([entry("a1", "assistant", [{ type: "text", text: "  " }])]);

    expect(result).toEqual([]);
  });

  test("normalizes thinking blocks as reasoning", () => {
    const result = normalizeClaudeCodeMessages([entry("a1", "assistant", [{ type: "thinking", thinking: "hmm" }])]);

    expect(result).toEqual([{ id: "a1-0", role: "assistant", parts: [{ type: "reasoning", text: "hmm" }], index: 0 }]);
  });

  test("normalizes tool_use blocks", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "tool_use", id: "call-1", name: "Read", input: { path: "/foo" } }]),
    ]);

    expect(result).toEqual([
      {
        id: "a1-0",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "Read",
            callId: "call-1",
            actionType: "read",
            status: "pending",
            state: { input: { path: "/foo" } },
          },
        ],
        index: 0,
      },
    ]);
  });

  test("normalizes tool_result blocks and resolves tool name", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "tool_use", id: "call-1", name: "Bash", input: {} }]),
      entry("a2", "assistant", [{ type: "tool_result", tool_use_id: "call-1", content: "output", is_error: false }]),
    ]);

    expect(result[0].parts[0]).toMatchObject({ type: "tool", tool: "Bash", status: "completed" });
  });

  test("marks errored tool_result as failed", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "tool_use", id: "call-1", name: "Edit", input: {} }]),
      entry("a2", "assistant", [{ type: "tool_result", tool_use_id: "call-1", content: "error msg", is_error: true }]),
    ]);

    expect(result[0].parts[0]).toMatchObject({
      type: "tool",
      tool: "Edit",
      status: "failed",
      state: { errorText: "Tool execution failed" },
    });
  });

  test("merges consecutive text messages with same role", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "text", text: "hello " }]),
      entry("a2", "assistant", [{ type: "text", text: "world" }]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].parts[0]).toMatchObject({ type: "text", text: "hello world" });
  });

  test("merges consecutive reasoning messages with same role", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "thinking", thinking: "first " }]),
      entry("a2", "assistant", [{ type: "thinking", thinking: "second" }]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].parts[0]).toMatchObject({ type: "reasoning", text: "first second" });
  });

  test("replaces pending tool with completed result", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "tool_use", id: "call-1", name: "Glob", input: {} }]),
      entry("a2", "assistant", [{ type: "tool_result", tool_use_id: "call-1", content: "files", is_error: false }]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].parts[0]).toMatchObject({ type: "tool", status: "completed" });
  });

  test("preserves tool input when replacing a completed TodoWrite result", () => {
    const todos = [
      { content: "Pick the component", status: "completed" },
      { content: "Wire the form", status: "in_progress" },
    ];

    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "tool_use", id: "call-1", name: "TodoWrite", input: { todos } }]),
      entry("a2", "assistant", [
        { type: "tool_result", tool_use_id: "call-1", content: "Todos updated", is_error: false },
      ]),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].parts[0]).toMatchObject({
      type: "tool",
      tool: "TodoWrite",
      actionType: "write",
      status: "completed",
      state: { input: { todos }, output: "Todos updated" },
    });
  });

  test("classifies tool actions correctly", () => {
    const tools = [
      { name: "Read", expected: "read" },
      { name: "Write", expected: "write" },
      { name: "TodoWrite", expected: "write" },
      { name: "Bash", expected: "execute" },
      { name: "WebFetch", expected: "network" },
      { name: "Agent", expected: "other" },
    ];

    for (const { name, expected } of tools) {
      const result = normalizeClaudeCodeMessages([
        entry("a1", "assistant", [{ type: "tool_use", id: "c1", name, input: {} }]),
      ]);
      expect(result[0].parts[0]).toMatchObject({ actionType: expected });
    }
  });

  test("resolves unknown role as assistant", () => {
    const result = normalizeClaudeCodeMessages([entry("u1", "something_else", "hi")]);

    expect(result[0].role).toBe("assistant");
  });

  test("assigns sequential index to messages", () => {
    const result = normalizeClaudeCodeMessages([
      entry("a1", "assistant", [{ type: "text", text: "one" }]),
      entry("a2", "assistant", [{ type: "tool_use", id: "c1", name: "Read", input: {} }]),
    ]);

    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
  });
});

// --- normalizeClaudeCodeStream ---

describe("normalizeClaudeCodeStream", () => {
  test("emits error for stderr events", async () => {
    const events: RawLogEvent[] = [{ type: "stderr", data: "something broke" }];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "system",
      parts: [{ type: "error", errorType: "other", message: "something broke" }],
      index: 0,
    });
  });

  test("maps stderr permission failures to permission error type", async () => {
    const events: RawLogEvent[] = [{ type: "stderr", data: "Permission denied while reading file" }];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result[0]).toMatchObject({
      role: "system",
      parts: [{ type: "error", errorType: "permission", message: "Permission denied while reading file" }],
      index: 0,
    });
  });

  test("skips non-stdout/stderr events", async () => {
    const events: RawLogEvent[] = [{ type: "ready" }, { type: "finished" }];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toEqual([]);
  });

  test("skips unparseable stdout", async () => {
    const events: RawLogEvent[] = [{ type: "stdout", data: "not json" }];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toEqual([]);
  });

  test("handles content_block_delta text_delta", async () => {
    const events: RawLogEvent[] = [
      stdout({ type: "content_block_delta", delta: { type: "text_delta", text: "hello" } }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "assistant", parts: [{ type: "text", text: "hello" }] });
  });

  test("handles content_block_delta thinking_delta", async () => {
    const events: RawLogEvent[] = [
      stdout({ type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hmm" } }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "assistant", parts: [{ type: "reasoning", text: "hmm" }] });
  });

  test("skips content_block_delta with no delta", async () => {
    const events: RawLogEvent[] = [stdout({ type: "content_block_delta" })];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toEqual([]);
  });

  test("handles content_block_start tool_use", async () => {
    const events: RawLogEvent[] = [
      stdout({
        type: "content_block_start",
        content_block: {
          type: "tool_use",
          name: "Edit",
          id: "call-1",
          input: { file_path: "/tmp/ticket.md", old_string: "before", new_string: "after" },
        },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool: "Edit",
          callId: "call-1",
          actionType: "write",
          status: "pending",
          state: { input: { file_path: "/tmp/ticket.md", old_string: "before", new_string: "after" } },
        },
      ],
    });
  });

  test("preserves pending Bash input for queued command rendering", async () => {
    const events: RawLogEvent[] = [
      stdout({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Bash",
              id: "call-1",
              input: { command: "git status", description: "Shows repo status" },
            },
          ],
        },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result[0]).toMatchObject({
      parts: [
        {
          type: "tool",
          tool: "Bash",
          status: "pending",
          state: { input: { command: "git status", description: "Shows repo status" } },
        },
      ],
    });
  });

  test("handles content_block_start tool_result", async () => {
    const events: RawLogEvent[] = [
      stdout({ type: "content_block_start", content_block: { type: "tool_use", name: "Read", id: "call-1" } }),
      stdout({
        type: "content_block_start",
        content_block: { type: "tool_result", tool_use_id: "call-1", content: "data", is_error: false },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      parts: [{ type: "tool", tool: "Read", status: "completed" }],
    });
  });

  test("handles content_block_start tool_result with error", async () => {
    const events: RawLogEvent[] = [
      stdout({ type: "content_block_start", content_block: { type: "tool_use", name: "Bash", id: "call-1" } }),
      stdout({
        type: "content_block_start",
        content_block: { type: "tool_result", tool_use_id: "call-1", content: "err", is_error: true },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result[1]).toMatchObject({
      parts: [{ type: "tool", tool: "Bash", status: "failed", state: { errorText: "Tool execution failed" } }],
    });
  });

  test("handles content_block_start thinking", async () => {
    const events: RawLogEvent[] = [stdout({ type: "content_block_start", content_block: { type: "thinking" } })];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ parts: [{ type: "reasoning", text: "" }] });
  });

  test("handles assistant event with string content", async () => {
    const events: RawLogEvent[] = [stdout({ type: "assistant", message: { content: "hello" } })];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: "assistant", parts: [{ type: "text", text: "hello" }] });
  });

  test("skips assistant event with empty string content", async () => {
    const events: RawLogEvent[] = [stdout({ type: "assistant", message: { content: "" } })];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toEqual([]);
  });

  test("handles assistant event with array content blocks", async () => {
    const events: RawLogEvent[] = [
      stdout({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "hi" },
            { type: "thinking", thinking: "hmm" },
          ],
        },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ parts: [{ type: "text", text: "hi" }] });
    expect(result[1]).toMatchObject({ parts: [{ type: "reasoning", text: "hmm" }] });
  });

  test("handles result event with usage", async () => {
    const events: RawLogEvent[] = [
      stdout({
        type: "result",
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "system",
      parts: [{ type: "token_usage", inputTokens: 100, outputTokens: 50, cacheReadTokens: 10, cacheWriteTokens: 5 }],
    });
  });

  test("handles result event with missing usage", async () => {
    const events: RawLogEvent[] = [stdout({ type: "result" })];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result[0]).toMatchObject({
      parts: [{ type: "token_usage", inputTokens: 0, outputTokens: 0 }],
    });
  });

  test("increments index across events", async () => {
    const events: RawLogEvent[] = [
      { type: "stderr", data: "err" },
      stdout({ type: "content_block_delta", delta: { type: "text_delta", text: "a" } }),
      stdout({ type: "content_block_delta", delta: { type: "text_delta", text: "b" } }),
    ];
    const result = (await collect(normalizeClaudeCodeStream(toAsync(events)))) as { index: number }[];

    expect(result.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  test("uses unknown tool for untracked tool_result", async () => {
    const events: RawLogEvent[] = [
      stdout({
        type: "content_block_start",
        content_block: { type: "tool_result", tool_use_id: "no-such-call", content: "data", is_error: false },
      }),
    ];
    const result = await collect(normalizeClaudeCodeStream(toAsync(events)));

    expect(result[0]).toMatchObject({ parts: [{ tool: "unknown" }] });
  });
});
