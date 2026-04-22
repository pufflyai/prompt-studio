import { describe, expect, test } from "bun:test";
import { normalizeClaudeCodeMessages, type SessionMessage, type ToolPart } from "pstdio-agents";
import { buildTimelineDocFromInvocations } from "./build-timeline";

const transcriptPath = new URL(
  "../../../../../pstdio-agents/src/providers/claude-code/mocks/tool-calls-transcript.jsonl",
  import.meta.url,
);

const transcriptEntries = (await Bun.file(transcriptPath).text())
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line)) as Parameters<typeof normalizeClaudeCodeMessages>[0];

const toolInvocations = normalizeClaudeCodeMessages(transcriptEntries)
  .flatMap((message: SessionMessage) => message.parts)
  .filter((part): part is ToolPart => part.type === "tool");

const getInvocation = (tool: string) => {
  const invocation = toolInvocations.find((part) => part.tool === tool);
  expect(invocation).toBeDefined();
  return invocation as ToolPart;
};

describe("buildTimelineDocFromInvocations", () => {
  test("resolves existing renderers for PascalCase Claude tool names", () => {
    const cases = [
      { tool: "Read", title: "Read file" },
      { tool: "Bash", title: "Run command" },
      { tool: "Grep", title: "Search files" },
      { tool: "Glob", title: "Find files" },
      { tool: "Skill", title: "Load skill" },
    ] as const;

    for (const { tool, title } of cases) {
      const doc = buildTimelineDocFromInvocations([getInvocation(tool)]);
      expect(doc.items[0].title).toContainEqual({ kind: "text", text: title, bold: true });
    }

    const readDoc = buildTimelineDocFromInvocations([getInvocation("Read")]);
    expect(readDoc.items[0].title).toContainEqual({
      kind: "link",
      text: "ticket.md",
      filePath: ".pstdio/tickets/PS-49/ticket.md",
    });
  });

  test("renders Edit with file link and before/after diff", () => {
    const doc = buildTimelineDocFromInvocations([getInvocation("Edit")]);
    const item = doc.items[0];

    expect(item.title).toContainEqual({ kind: "text", text: "Edit file", bold: true });
    expect(item.title).toContainEqual({
      kind: "link",
      text: "default-renderers.ts",
      filePath: "packages/ui/src/components/chat-ui/tool-rendering/default-renderers.ts",
    });
    expect(item.blocks).toContainEqual({
      type: "diff",
      language: "diff",
      original: "const renderer = null;",
      modified: "const renderer = createRenderer();",
      sideBySide: false,
    });
  });

  test("renders TodoWrite as structured todo entries", () => {
    const doc = buildTimelineDocFromInvocations([getInvocation("TodoWrite")]);
    const item = doc.items[0];

    expect(item.title).toContainEqual({ kind: "text", text: "Update todos", bold: true });
    expect(item.indicator).toEqual({ type: "icon", icon: "ls" });
    expect(item.blocks).toContainEqual({ type: "text", text: "completed | high | Inspect renderer lookup" });
    expect(item.blocks).toContainEqual({ type: "text", text: "in_progress | medium | Implement Edit renderer" });
  });

  test("renders TodoWrite from metadata when input todos are absent", () => {
    const doc = buildTimelineDocFromInvocations([
      {
        type: "tool",
        tool: "TodoWrite",
        status: "completed",
        state: {
          status: "completed",
          metadata: {
            newTodos: [{ content: "Run validation", status: "pending", priority: "high" }],
          },
        },
      },
    ]);

    expect(doc.items[0].blocks).toContainEqual({ type: "text", text: "pending | high | Run validation" });
  });

  test("uses intentional icon mapping for Edit", () => {
    const doc = buildTimelineDocFromInvocations([getInvocation("Edit")]);

    expect(doc.items[0].indicator).toEqual({ type: "icon", icon: "write_file" });
  });
});
