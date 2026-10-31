import { expect, test } from "bun:test";
import { $getRoot } from "lexical";
import * as Y from "yjs";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { captureMarkdownTables } from "./markdown-source-tables";
import { createMarkdownTextDocument } from "./markdown-text-document";
import { $isDataTableNode } from "./nodes/DataTableNode";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

const initial = "| A | B |\n| --- | --- |\n| left | right |";

for (const [name, next, row, column] of [
  ["another cell changes", initial.replace("right", "REMOTE"), 0, 0],
  ["a peer inserts an earlier row", initial.replace("| left", "| added | row |\n| left"), 1, 0],
  ["a peer inserts an earlier column", "| New | A | B |\n| --- | --- | --- |\n| added | left | right |", 0, 1],
] as const)
  test(`table projection retains existing editor and cell identities when ${name}`, () => {
    const shared = new Y.Doc();
    shared.getText("content").insert(0, initial);
    const binding = createMarkdownTextDocument(shared);
    const editor = createHeadlessEditor();
    const source = createMarkdownSourceDocument(initial);
    editor.update(() => source.importToLexical(), { discrete: true });
    let projection: ReturnType<typeof captureMarkdownTables>;
    let key = "";
    let rowId = "";
    let columnId = "";
    editor.read(() => {
      const table = $getRoot().getFirstChild()!;
      if (!$isDataTableNode(table)) throw new Error("Missing table");
      key = table.getKey();
      rowId = table.getTable().rows[0]!.id;
      columnId = table.getTable().columns[0]!.id;
      projection = captureMarkdownTables($getRoot(), initial, binding);
    });
    binding.write(next);
    editor.update(() => source.reconcileFromSource(next, projection!), { discrete: true });
    editor.read(() => {
      const table = $getRoot().getFirstChild()!;
      if (!$isDataTableNode(table)) throw new Error("Missing table");
      const value = table.getTable();
      expect(table.getKey()).toBe(key);
      expect(value.rows[row]!.id).toBe(rowId);
      expect(value.columns[column]!.id).toBe(columnId);
      expect(value.rows[row]!.cells[columnId]).toBe("left");
      expect(new Set(value.rows.map((row) => row.id)).size).toBe(value.rows.length);
      expect(new Set(value.columns.map((column) => column.id)).size).toBe(value.columns.length);
      expect(source.exportFromLexical($getRoot())).toBe(next);
    });
    binding.destroy();
    shared.destroy();
  });

test("table structure preserves identity without leading pipes when cell text changes", () => {
  const initial = "A | B\n--- | ---\nl | r";
  const next = "C | D\n--- | ---\nx | y";
  const shared = new Y.Doc();
  shared.getText("content").insert(0, initial);
  const binding = createMarkdownTextDocument(shared);
  const editor = createHeadlessEditor();
  const source = createMarkdownSourceDocument(initial);
  editor.update(() => source.importToLexical(), { discrete: true });
  let projection: ReturnType<typeof captureMarkdownTables>;
  let key = "";
  let rowId = "";
  editor.read(() => {
    const table = $getRoot().getFirstChild()!;
    if (!$isDataTableNode(table)) throw new Error("Missing table");
    key = table.getKey();
    rowId = table.getTable().rows[0]!.id;
    projection = captureMarkdownTables($getRoot(), initial, binding);
  });
  binding.write(next);
  editor.update(() => source.reconcileFromSource(next, projection!), { discrete: true });
  editor.read(() => {
    const table = $getRoot().getFirstChild()!;
    if (!$isDataTableNode(table)) throw new Error("Missing table");
    expect(table.getKey()).toBe(key);
    expect(table.getTable().rows[0]!.id).toBe(rowId);
  });
  binding.destroy();
  shared.destroy();
});
