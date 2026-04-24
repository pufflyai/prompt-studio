import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolPart } from "../../types";
import { normalizeClaudeCodeMessages } from "./claude-code-normalizer";
import type { ClaudeCodeTranscriptEntry } from "./claude-code-types";

const transcriptPath = resolve(import.meta.dir, "./mocks/tool-calls-transcript.jsonl");

const loadTranscriptEntries = () => {
  const source = readFileSync(transcriptPath, "utf8");

  return source
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ClaudeCodeTranscriptEntry);
};

describe("normalizeClaudeCodeMessages metadata", () => {
  test("preserves structured Edit tool result metadata", () => {
    const result = normalizeClaudeCodeMessages(loadTranscriptEntries());
    const editTool = result
      .flatMap((message) => message.parts)
      .find((part): part is ToolPart => part.type === "tool" && part.tool === "Edit");

    expect(editTool).toMatchObject({
      type: "tool",
      state: {
        output: {
          filePath: expect.stringContaining("ticket.md"),
          oldString: expect.stringContaining("Today, hooks embed prompt text directly in shell scripts:"),
          newString: expect.stringContaining("post-attempt-status-changes-requested"),
        },
      },
    });
  });

  test("preserves structured TodoWrite tool result metadata", () => {
    const result = normalizeClaudeCodeMessages(loadTranscriptEntries());
    const todoTool = result
      .flatMap((message) => message.parts)
      .find((part): part is ToolPart => part.type === "tool" && part.tool === "TodoWrite");

    expect(todoTool).toMatchObject({ type: "tool" });
    expect(todoTool?.state?.output).toMatchObject({
      newTodos: expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("Phase 1: API"),
          status: "in_progress",
        }),
      ]),
    });
  });
});
