import { describe, expect, test } from "bun:test";
import type { SessionMessage, ToolPart } from "../agent-types";
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
});
