import { describe, expect, test } from "bun:test";
import type { CommandParamEntry } from "./command-palette-params";
import { createCommandFilesParamValue } from "./command-palette-params";
import { buildCommandParam, commandParamName, readCommandParamValue } from "./command-param-descriptors";

const entry = (overrides: Partial<CommandParamEntry> & { key: string; type: string }): CommandParamEntry => ({
  label: overrides.key,
  ...overrides,
});

describe("command param descriptors", () => {
  test("marks required params in the control name", () => {
    expect(commandParamName(entry({ key: "title", type: "text", label: "Title" }))).toBe("Title");
    expect(commandParamName(entry({ key: "title", type: "text", label: "Title", required: true }))).toBe("Title *");
  });

  test("maps declared param types onto editor controls", () => {
    expect(buildCommandParam(entry({ key: "flag", type: "boolean" }), true).type).toBe("boolean");
    expect(buildCommandParam(entry({ key: "amount", type: "number" }), "3")).toMatchObject({
      type: "number",
      defaultValue: 3,
    });
    expect(buildCommandParam(entry({ key: "notes", type: "markdown" }), "# Hi").type).toBe("markdown");
    expect(buildCommandParam(entry({ key: "title", type: "text" }), "Hi")).toMatchObject({
      type: "text",
      singleLine: true,
    });
    expect(buildCommandParam(entry({ key: "context", type: "longtext" }), "Hi")).toMatchObject({
      type: "text",
      singleLine: false,
    });
    expect(
      buildCommandParam(
        entry({ key: "files", type: "files", accept: ".csv", multiple: false }),
        createCommandFilesParamValue(),
      ),
    ).toMatchObject({ type: "fileUpload", accept: ".csv", multiple: false, defaultValue: [] });
  });

  test("renders selections from declared options and clears when optional", () => {
    const param = buildCommandParam(
      entry({
        key: "mode",
        type: "select",
        label: "Mode",
        options: [
          { value: "worktree", label: "Worktree", icon: "GitFork" },
          { value: "current_branch", label: "Current branch" },
        ],
      }),
      "worktree",
    );

    expect(param).toMatchObject({
      type: "selection",
      defaultValue: "worktree",
      clearable: true,
      options: [
        { id: "worktree", name: "Worktree", icon: "GitFork" },
        { id: "current_branch", name: "Current branch" },
      ],
    });
  });

  test("keeps required selections from being cleared", () => {
    const param = buildCommandParam(
      entry({ key: "mode", type: "select", required: true, options: [{ value: "a", label: "A" }] }),
      "a",
    );

    expect(param).toMatchObject({ type: "selection", clearable: false });
  });

  test("selects many values for multi-select params", () => {
    const param = buildCommandParam(
      entry({ key: "tags", type: "multi-select", options: [{ value: "bug", label: "Bug" }] }),
      ["bug"],
    );

    expect(param).toMatchObject({ type: "selection", multiSelect: true, defaultValue: ["bug"] });
  });

  test("falls back to a text control for a selection without options", () => {
    expect(buildCommandParam(entry({ key: "template", type: "template" }), "").type).toBe("text");
  });

  test("edits structured params as the json they are serialized to", () => {
    expect(buildCommandParam(entry({ key: "agent", type: "harness" }), '{"harnessId":"a"}')).toMatchObject({
      type: "text",
      singleLine: false,
      defaultValue: '{"harnessId":"a"}',
    });
  });

  test("narrows editor values back to command param values", () => {
    expect(readCommandParamValue(true)).toBe(true);
    expect(readCommandParamValue(3)).toBe("3");
    expect(readCommandParamValue(["a", "b"])).toEqual(["a", "b"]);
    expect(readCommandParamValue(null)).toBe("");
  });

  test("preserves selected browser files instead of stringifying them", () => {
    const file = new File(["first"], "first.csv", { type: "text/csv" });
    const uploads = [{ id: "first", file, status: "queued" as const }];

    expect(readCommandParamValue(uploads, entry({ key: "files", type: "files" }))).toEqual({
      refs: [],
      uploads,
    });
  });
});
