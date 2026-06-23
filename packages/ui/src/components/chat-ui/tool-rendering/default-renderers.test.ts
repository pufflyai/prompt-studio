import { describe, expect, it } from "bun:test";
import type { ToolPart } from "../components/message-types";
import { buildTimelineDocFromInvocations } from "./build-timeline";

const renderInvocation = (invocation: ToolPart) => {
  return buildTimelineDocFromInvocations([invocation]).items[0];
};

describe("todowrite renderer", () => {
  it("renders Claude TodoWrite payloads with the shared readonly todo list", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "TodoWrite",
      status: "completed",
      state: {
        status: "completed",
        input: {
          todos: [
            { content: "Pick the component", status: "completed" },
            { content: "Wire the form", status: "in_progress" },
          ],
        },
      },
    });

    expect(item.indicator).toEqual({ type: "icon", icon: "todo" });
    expect(item.title).toEqual([
      { kind: "text", text: "Update todos", bold: true },
      { kind: "text", text: "2 items", muted: true },
    ]);
    expect(item.blocks).toEqual([
      {
        type: "todo-list",
        items: [
          { label: "Pick the component", checked: true },
          { label: "Wire the form", checked: false },
        ],
      },
    ]);
  });

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
        type: "todo-list",
        items: [
          { label: "Implement API", checked: false },
          { label: "Run validate", checked: true },
        ],
      },
    ]);
  });

  it("renders todos that use title for content", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "todowrite",
      state: {
        status: "completed",
        input: {
          todos: [{ id: "1", title: "Fix bug", status: "in_progress" }],
        },
      },
    });

    expect(item.title).toEqual([
      { kind: "text", text: "Update todos", bold: true },
      { kind: "text", text: "1 item", muted: true },
    ]);
    expect(item.blocks).toEqual([
      {
        type: "todo-list",
        items: [{ label: "Fix bug", checked: false }],
      },
    ]);
  });

  it("renders explicit empty todo state", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "todowrite",
      state: {
        status: "completed",
        input: { todos: [] },
      },
    });

    expect(item.title).toEqual([
      { kind: "text", text: "Update todos", bold: true },
      { kind: "text", text: "0 items", muted: true },
    ]);
    expect(item.blocks).toEqual([{ type: "comment", text: "No todos" }]);
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
        type: "todo-list",
        items: [
          { label: "Prepare release", checked: false },
          { label: "Ship", checked: true },
        ],
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
        type: "todo-list",
        items: [{ label: "Valid todo", checked: false }],
      },
    ]);
  });
});

describe("question renderer", () => {
  it("renders submitted question calls without duplicated response content", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "question",
      state: {
        input: {
          questions: [
            {
              id: "language",
              question: "Which language do you want to use?",
              options: ["TypeScript", "Python"],
            },
          ],
        },
        output: "Which language do you want to use?: TypeScript",
      },
    });

    expect(item.blocks).toEqual([]);
  });

  it("hides question forms when submitted answers are stored in metadata", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "question",
      state: {
        input: {
          questions: [
            {
              id: "language",
              question: "Which language do you want to use?",
              options: ["TypeScript", "Python"],
            },
          ],
        },
        output: "",
        metadata: { answers: [["TypeScript"]] },
      },
    });

    expect(item.blocks).toEqual([]);
  });

  it("renders case-insensitive Question tool payloads with the question icon", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "Question",
      state: {
        input: {
          questions: [
            {
              id: "language",
              question: "Which language do you want to use?",
              options: ["TypeScript", "Python"],
            },
          ],
        },
      },
    });

    expect(item.indicator).toEqual({ type: "icon", icon: "question" });
    expect(item.blocks?.[0]).toMatchObject({ type: "question-form" });
  });

  it("renders Question tool payloads when input is JSON text", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "Question",
      state: {
        input: JSON.stringify({
          questions: [
            {
              header: "Weather",
              question: "What's the weather like where you are today?",
              options: [
                { label: "Sunny", description: "Sunny and warm" },
                { label: "Rainy", description: "Rainy or wet conditions" },
              ],
            },
          ],
        }),
      },
    });

    expect(item.blocks).toEqual([
      {
        type: "question-form",
        questions: [
          {
            id: "question-0",
            question: "What's the weather like where you are today?",
            options: [
              { label: "Sunny", description: "Sunny and warm" },
              { label: "Rainy", description: "Rainy or wet conditions" },
            ],
            multiple: false,
            required: false,
            allowCustomAnswer: false,
          },
        ],
      },
    ]);
  });

  it("renders question tool payloads as a form block", () => {
    const item = renderInvocation({
      type: "tool",
      tool: "question",
      state: {
        input: {
          questions: [
            {
              id: "language",
              question: "Which language do you want to use?",
              options: [{ label: "TypeScript", description: "Typed JavaScript" }, "Python"],
              required: true,
            },
            {
              id: "details",
              type: "freeform",
              question: "Anything else?",
            },
          ],
        },
      },
    });

    expect(item.title).toEqual([
      { kind: "text", text: "Question", bold: true },
      { kind: "text", text: "2 fields", muted: true },
    ]);
    expect(item).toMatchObject({ expandable: false });
    expect(item.blocks).toEqual([
      {
        type: "question-form",
        questions: [
          {
            id: "language",
            question: "Which language do you want to use?",
            options: [
              { label: "TypeScript", description: "Typed JavaScript" },
              { label: "Python", description: undefined },
            ],
            multiple: false,
            required: true,
            allowCustomAnswer: false,
          },
          {
            id: "details",
            question: "Anything else?",
            options: [],
            multiple: false,
            required: false,
            allowCustomAnswer: true,
          },
        ],
      },
    ]);
  });
});
