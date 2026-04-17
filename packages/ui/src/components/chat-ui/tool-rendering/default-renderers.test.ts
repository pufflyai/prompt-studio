import { describe, expect, it } from "vitest";
import type { ToolPart } from "../agent-types";
import { createDefaultToolRenderers } from "./default-renderers";

const renderers = createDefaultToolRenderers();

const makeToolPart = (
  tool: string,
  input: Record<string, unknown>,
  output?: unknown,
  status = "completed",
): ToolPart => ({
  type: "tool",
  tool,
  state: {
    status,
    input,
    output: output ?? "ok",
  },
});

describe("Write renderer", () => {
  it("returns item with file link in title and content code block", () => {
    const invocation = makeToolPart("Write", {
      file_path: "src/app/index.ts",
      content: 'console.log("hello");',
    });

    const result = renderers.Write!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "link", text: "index.ts", filePath: "src/app/index.ts" }),
      ]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", code: 'console.log("hello");' })]),
    );
  });

  it("shows error block on error state", () => {
    const invocation = makeToolPart("Write", { file_path: "x.ts", content: "x" }, undefined, "error");
    invocation.state!.errorText = "Permission denied";

    const result = renderers.Write!(invocation);
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "comment", text: "Permission denied" })]),
    );
  });
});

describe("Edit renderer", () => {
  it("returns item with file link and diff block", () => {
    const invocation = makeToolPart("Edit", {
      file_path: "src/utils.ts",
      old_string: "const a = 1;",
      new_string: "const a = 2;",
    });

    const result = renderers.Edit!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "link", text: "utils.ts", filePath: "src/utils.ts" })]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "diff", original: "const a = 1;", modified: "const a = 2;" }),
      ]),
    );
  });
});

describe("NotebookEdit renderer", () => {
  it("returns item with notebook file link and source code block", () => {
    const invocation = makeToolPart("NotebookEdit", {
      notebook_path: "notebooks/analysis.ipynb",
      cell_number: 3,
      new_source: "import pandas as pd",
    });

    const result = renderers.NotebookEdit!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "link", text: "analysis.ipynb", filePath: "notebooks/analysis.ipynb" }),
      ]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", code: "import pandas as pd" })]),
    );
  });
});

describe("Agent renderer", () => {
  it("returns item with description in title and output text block", () => {
    const invocation = makeToolPart(
      "Agent",
      { description: "Search for usage", prompt: "Find all usages of foo" },
      "Found 3 usages in src/",
    );

    const result = renderers.Agent!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "text", text: "Search for usage", muted: true })]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", code: "Found 3 usages in src/" })]),
    );
  });
});

describe("Task renderer", () => {
  it("returns item with description in title and output text block", () => {
    const invocation = makeToolPart(
      "Task",
      { description: "Run linter", prompt: "Run eslint on src/" },
      "All files passed",
    );

    const result = renderers.Task!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "text", text: "Run linter", muted: true })]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", code: "All files passed" })]),
    );
  });
});

describe("WebFetch renderer", () => {
  it("returns item with URL link in title and response code block", () => {
    const invocation = makeToolPart("WebFetch", { url: "https://example.com/api" }, '{"data": "hello"}');

    const result = renderers.WebFetch!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "link", text: "https://example.com/api", href: "https://example.com/api" }),
      ]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", code: '{"data": "hello"}' })]),
    );
  });
});

describe("WebSearch renderer", () => {
  it("returns item with query in title and results code block", () => {
    const invocation = makeToolPart("WebSearch", { query: "typescript generics" }, "Result 1: ...\nResult 2: ...");

    const result = renderers.WebSearch!(invocation);
    expect(result).not.toBeNull();
    expect(result!.title).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "text", text: "typescript generics", muted: true })]),
    );
    expect(result!.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", code: "Result 1: ...\nResult 2: ..." })]),
    );
  });
});
