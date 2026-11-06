import { expect, test } from "bun:test";
import type { TreeListSection } from "@pstdio/ui";
import type { TreeActionParamsRequest } from "./tree-actions";
import { withTreeInlineInput } from "./tree-inline-input";

test("inline tree actions keep failed edits and preserve the supplied command arguments", async () => {
  const sections: TreeListSection[] = [
    { id: "files", nodes: [{ id: "folder", label: "src", children: [{ id: "file", label: "one.ts" }] }] },
  ];
  let submitted: unknown;
  let closed = false;
  const request: TreeActionParamsRequest = {
    inlineInput: { field: "name", nodeId: "file", placement: "replace" },
    request: {
      record: { command: { id: "rename", label: "Rename", params: { name: { type: "text", required: true } } } },
      label: "Rename",
      args: { path: "src/one.ts", name: "one.ts" },
    },
    run: async (args) => {
      submitted = args;
      throw new Error("Name already exists");
    },
  };
  const result = withTreeInlineInput(sections, request, () => {
    closed = true;
  });
  const input = result[0]!.nodes[0]!.children![0]!.inlineInput!;
  expect(input.defaultValue).toBe("one.ts");
  await expect(input.onCommit("two.ts")).rejects.toThrow("Name already exists");
  expect(submitted).toEqual({ path: "src/one.ts", name: "two.ts" });
  expect(closed).toBe(false);
  input.onCancel?.();
  expect(closed).toBe(true);
  expect(sections[0]!.nodes[0]!.children![0]!.inlineInput).toBeUndefined();
});

test("inline creation inserts into the chosen folder or at the tree root and closes only after saving", async () => {
  const sections: TreeListSection[] = [{ id: "files", nodes: [{ id: "folder", label: "src" }] }];
  let closed = false;
  const request: TreeActionParamsRequest = {
    inlineInput: { field: "name", nodeId: "folder", placement: "child" },
    request: {
      record: { command: { id: "new", label: "New file", params: { name: { type: "text", required: true } } } },
      label: "New file",
    },
    run: async () => {},
  };
  const folder = withTreeInlineInput(sections, request, () => {
    closed = true;
  })[0]!.nodes[0]!;
  await expect(folder.children![0]!.inlineInput!.onCommit(" ")).rejects.toThrow("required");
  expect(closed).toBe(false);
  await folder.children![0]!.inlineInput!.onCommit("new.ts");
  expect(closed).toBe(true);
  request.inlineInput!.nodeId = undefined;
  expect(withTreeInlineInput(sections, request, () => {})[0]!.nodes[0]!.inlineInput).toBeDefined();
});

test.each(["header", "footer"])("inline actions keep their originating %s section", (id) => {
  const request: TreeActionParamsRequest = {
    sectionId: id,
    inlineInput: { field: "name", placement: "child" },
    request: { record: { command: { id: "new", label: "New", params: { name: { type: "text" } } } }, label: "New" },
    run: async () => {},
  };
  const body = [{ id: "body", nodes: [] }];
  expect(withTreeInlineInput(body, request, () => {})).toEqual(body);
  expect(withTreeInlineInput([{ id, nodes: [] }], request, () => {})[0].nodes[0].inlineInput).toBeDefined();
});

test("pending inline rows cannot alias provider IDs", () => {
  const request: TreeActionParamsRequest = {
    inlineInput: { field: "name", placement: "child" },
    request: { record: { command: { id: "new", label: "New", params: { name: { type: "text" } } } }, label: "New" },
    run: async () => {},
  };
  const sections = [
    {
      id: "files",
      nodes: [
        {
          id: "workbench:inline-input",
          label: "Existing",
          children: [{ id: "workbench:inline-input:1", label: "Nested" }],
        },
      ],
    },
  ];
  const result = withTreeInlineInput(sections, request, () => {});
  expect(result[0].nodes[0].id).toBe("workbench:inline-input:2");
  expect(result[0].nodes[1].id).toBe("workbench:inline-input");
});
