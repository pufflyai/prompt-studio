import { describe, expect, it } from "bun:test";
import type { ToolPart } from "../agent-types";
import { buildTimelineDocFromInvocations } from "./build-timeline";

const makeToolPart = (tool: string, input?: Record<string, unknown>, output?: unknown): ToolPart => ({
  type: "tool",
  tool,
  state: { status: "completed", input, output },
});

describe("getRenderer case sensitivity", () => {
  it("finds the read renderer with PascalCase tool name", () => {
    const doc = buildTimelineDocFromInvocations([makeToolPart("Read", { file_path: "/src/index.ts" })]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment).toBeDefined();
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Read file");
  });

  it("finds the bash renderer with PascalCase tool name", () => {
    const doc = buildTimelineDocFromInvocations([makeToolPart("Bash", { command: "ls -la" })]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Run command");
  });

  it("finds the grep renderer with PascalCase tool name", () => {
    const doc = buildTimelineDocFromInvocations([makeToolPart("Grep", { pattern: "foo" })]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Search files");
  });

  it("still finds renderers with lowercase tool names", () => {
    const doc = buildTimelineDocFromInvocations([makeToolPart("read", { file_path: "/src/index.ts" })]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Read file");
  });
});

describe("Edit renderer", () => {
  it("renders with file link and diff block", () => {
    const doc = buildTimelineDocFromInvocations([
      makeToolPart("Edit", {
        file_path: "src/utils/helpers.ts",
        old_string: "const a = 1;",
        new_string: "const a = 2;",
      }),
    ]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Edit file");

    const linkSegment = item.title.find((s) => s.kind === "link");
    expect(linkSegment).toBeDefined();
    expect(linkSegment!.kind === "link" && linkSegment!.text).toBe("helpers.ts");

    const diffBlock = item.blocks?.find((b) => b.type === "diff");
    expect(diffBlock).toBeDefined();
    expect(diffBlock!.type === "diff" && diffBlock!.original).toBe("const a = 1;");
    expect(diffBlock!.type === "diff" && diffBlock!.modified).toBe("const a = 2;");
  });

  it("renders without diff when old_string and new_string are missing", () => {
    const doc = buildTimelineDocFromInvocations([makeToolPart("Edit", { file_path: "src/index.ts" })]);

    const item = doc.items[0];
    expect(item.blocks?.find((b) => b.type === "diff")).toBeUndefined();
  });
});

describe("TodoWrite renderer", () => {
  it("renders a task list from todos input", () => {
    const doc = buildTimelineDocFromInvocations([
      makeToolPart("TodoWrite", {
        todos: [
          { id: "1", content: "Fix bug", status: "completed", priority: "high" },
          { id: "2", content: "Write tests", status: "in_progress", priority: "medium" },
          { id: "3", content: "Deploy", status: "pending", priority: "low" },
        ],
      }),
    ]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Update tasks");

    const textBlock = item.blocks?.find((b) => b.type === "text");
    expect(textBlock).toBeDefined();
    expect(textBlock!.type === "text" && textBlock!.text).toContain("Fix bug");
    expect(textBlock!.type === "text" && textBlock!.text).toContain("Write tests");
    expect(textBlock!.type === "text" && textBlock!.text).toContain("Deploy");
  });

  it("handles empty todos array", () => {
    const doc = buildTimelineDocFromInvocations([makeToolPart("TodoWrite", { todos: [] })]);

    const item = doc.items[0];
    const textSegment = item.title.find((s) => s.kind === "text" && s.bold);
    expect(textSegment!.kind === "text" && textSegment!.text).toBe("Update tasks");
    expect(item.blocks?.length ?? 0).toBe(0);
  });
});
