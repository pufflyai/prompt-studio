import { describe, expect, test } from "bun:test";
import type { SessionMessage, ToolPart } from "../components/message-types";
import fixtureMessages from "./__fixtures__/tool-calls-messages.json";
import { buildTimelineDocFromInvocations } from "./build-timeline";

const getToolInvocations = () => {
  const messages = fixtureMessages as SessionMessage[];

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
        type: "todo-list",
        items: expect.arrayContaining([
          expect.objectContaining({
            label: "Run validate and verify packages",
            checked: false,
          }),
        ]),
      }),
    );
    expect(item?.blocks).not.toContainEqual(expect.objectContaining({ type: "code", language: "json" }));
  });

  test("renders generic tool input and output with labels", () => {
    const doc = buildTimelineDocFromInvocations([
      {
        type: "tool",
        tool: "custom_tool",
        state: {
          status: "completed",
          input: { path: "src/app.ts" },
          output: { ok: true },
        },
      },
    ]);

    expect(doc.items).toHaveLength(1);
    expect(doc.items[0]?.blocks).toEqual([
      { type: "text", text: "Input" },
      { type: "code", language: "json", code: '{\n  "path": "src/app.ts"\n}' },
      { type: "text", text: "Output" },
      { type: "code", language: "json", code: '{\n  "ok": true\n}' },
    ]);
  });

  test("renders file-like generic output as a code preview", () => {
    const doc = buildTimelineDocFromInvocations([
      {
        type: "tool",
        tool: "custom_tool",
        state: {
          status: "completed",
          output: { filePath: "src/app.ts", content: "export const value = 1;" },
        },
      },
    ]);

    expect(doc.items[0]?.title).toContainEqual({ kind: "link", text: "src/app.ts", filePath: "src/app.ts" });
    expect(doc.items[0]?.blocks).toEqual([
      { type: "text", text: "Output" },
      { type: "code", language: "ts", code: "export const value = 1;" },
    ]);
  });

  test("renders screenshot output as an image block", () => {
    const doc = buildTimelineDocFromInvocations([
      {
        type: "tool",
        tool: "browser_screenshot",
        state: {
          status: "completed",
          output: { url: "https://example.com/screenshot.png", mediaType: "image/png" },
        },
      },
    ]);

    expect(doc.items[0]?.blocks).toContainEqual({
      type: "image",
      src: "https://example.com/screenshot.png",
      alt: "Browser Screenshot output",
    });
  });

  test("filters generic tools with no visible title or blocks", () => {
    const doc = buildTimelineDocFromInvocations([{ type: "tool", tool: "", state: { output: {} } }]);

    expect(doc.items).toEqual([]);
  });
});
