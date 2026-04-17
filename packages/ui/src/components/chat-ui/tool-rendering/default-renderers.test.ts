import { describe, expect, it } from "bun:test";
import type { ToolPart } from "../agent-types";
import { buildTimelineDocFromInvocations } from "./build-timeline";

const renderInvocation = (invocation: ToolPart) => {
  return buildTimelineDocFromInvocations([invocation]).items[0];
};

describe("todowrite renderer", () => {
  it("renders todos from object payload", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "todowrite",
      status: "completed",
      state: {
        status: "completed",
        input: {
          todos: [
            { content: "Implement API", status: "in_progress", priority: "high" },
            { content: "Run validate", status: "completed", priority: "medium" },
          ],
        },
      },
    });

    expect(item.title).toEqual([
      { kind: "text", text: "Update todos", bold: true },
      { kind: "text", text: "2 items", muted: true },
    ]);
    expect(item.blocks).toEqual([
      {
        type: "code",
        language: "markdown",
        code: ["- [ ] Implement API (in_progress · high)", "- [x] Run validate (completed · medium)"].join("\n"),
      },
    ]);
  });

  it("renders todos from array output payload", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "todowrite",
      state: {
        status: "completed",
        output: [
          { content: "Prepare release", status: "pending", priority: "low" },
          { content: "Ship", status: "completed", priority: "high" },
        ],
      },
    });

    expect(item.blocks).toEqual([
      {
        type: "code",
        language: "markdown",
        code: ["- [ ] Prepare release (pending · low)", "- [x] Ship (completed · high)"].join("\n"),
      },
    ]);
  });

  it("filters invalid todo entries and empty-string metadata", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "todowrite",
      state: {
        status: "completed",
        output: {
          todos: [
            { content: "Valid todo", status: "pending", priority: "" },
            { content: "   ", status: "completed", priority: "high" },
            { status: "pending", priority: "low" },
            "not-an-object",
          ],
        },
      },
    });

    expect(item.title).toEqual([
      { kind: "text", text: "Update todos", bold: true },
      { kind: "text", text: "1 item", muted: true },
    ]);
    expect(item.blocks).toEqual([
      {
        type: "code",
        language: "markdown",
        code: "- [ ] Valid todo (pending)",
      },
    ]);
  });
});
