import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ClaudeCodeTranscriptEntry,
  normalizeClaudeCodeMessages,
  type SessionMessage,
  type ToolPart,
} from "pstdio-agents";
import { buildTimelineDocFromInvocations } from "./build-timeline";

const transcriptPath = resolve(
  import.meta.dir,
  "../../../../../pstdio-agents/src/providers/claude-code/mocks/tool-calls-transcript.jsonl",
);

const loadTranscriptEntries = () => {
  const source = readFileSync(transcriptPath, "utf8");

  return source
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ClaudeCodeTranscriptEntry);
};

const getToolInvocations = () => {
  const messages = normalizeClaudeCodeMessages(loadTranscriptEntries()) as SessionMessage[];

  return messages.flatMap((message) => message.parts).filter((part): part is ToolPart => part.type === "tool");
};

describe("buildTimelineDocFromInvocations", () => {
  test("resolves existing renderers for Claude tool names", () => {
    const doc = buildTimelineDocFromInvocations(getToolInvocations());

    expect(doc.items[0]?.title).toContainEqual({ kind: "text", text: "Read file", bold: true });
    expect(doc.items[2]?.title).toContainEqual({ kind: "text", text: "Run command", bold: true });
    expect(doc.items[4]?.title).toContainEqual({ kind: "text", text: "Load skill", bold: true });
    expect(doc.items[0]?.blocks).toEqual([]);
    expect(doc.items[2]?.blocks?.[0]).toMatchObject({ type: "code", language: "text" });
  });

  test("renders Edit tool output as a linked diff", () => {
    const doc = buildTimelineDocFromInvocations(getToolInvocations());
    const item = doc.items[1];

    expect(item?.title).toContainEqual({ kind: "text", text: "Edit file", bold: true });
    expect(item?.title).toContainEqual({
      kind: "link",
      text: "ticket.md",
      filePath: expect.stringContaining("ticket.md"),
    });
    expect(item?.blocks).toContainEqual(
      expect.objectContaining({
        type: "diff",
        original: expect.stringContaining("Today, hooks embed prompt text directly in shell scripts:"),
        modified: expect.stringContaining("post-attempt-status-changes-requested"),
      }),
    );
  });

  test("renders TodoWrite tool output as structured todo blocks", () => {
    const doc = buildTimelineDocFromInvocations(getToolInvocations());
    const item = doc.items[3];

    expect(item?.title).toContainEqual({ kind: "text", text: "Update todos", bold: true });
    expect(item?.blocks).toContainEqual(
      expect.objectContaining({
        type: "component",
      }),
    );
    expect(item?.blocks).not.toContainEqual(expect.objectContaining({ type: "code", language: "json" }));
  });
});
