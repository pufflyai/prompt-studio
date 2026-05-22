import { describe, expect, it } from "bun:test";
import { buildVirtualRows } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";
import { resolveTreeListKeyboardNavigation } from "./tree-list-model";

const sections: TreeListSection[] = [
  {
    id: "files",
    nodes: [
      {
        id: "folder:src",
        label: "src",
        isContainer: true,
        children: [
          { id: "file:src/a.ts", label: "a.ts" },
          {
            id: "folder:src/components",
            label: "components",
            isContainer: true,
            children: [{ id: "file:src/components/button.tsx", label: "button.tsx" }],
          },
        ],
      },
      { id: "file:readme.md", label: "readme.md" },
    ],
  },
];

const labeledSections: TreeListSection[] = [
  { id: "open", label: "Open Editors", nodes: [{ id: "file:open/x.ts", label: "x.ts" }] },
  { id: "files", label: "Files", nodes: [{ id: "file:a.ts", label: "a.ts" }] },
];

describe("buildVirtualRows", () => {
  it("flattens visible nested nodes with their tree level", () => {
    const rows = buildVirtualRows(sections, [], ["folder:src"]);

    expect(rows.map((row) => row.key)).toEqual([
      "files:folder:src",
      "files:file:src/a.ts",
      "files:folder:src/components",
      "files:file:readme.md",
    ]);
    expect(rows.map((row) => (row.kind === "node" ? row.level : null))).toEqual([0, 1, 1, 0]);
  });

  it("includes deeper descendants only when their folder is expanded", () => {
    const rows = buildVirtualRows(sections, [], ["folder:src", "folder:src/components"]);

    expect(rows.map((row) => row.key)).toEqual([
      "files:folder:src",
      "files:file:src/a.ts",
      "files:folder:src/components",
      "files:file:src/components/button.tsx",
      "files:file:readme.md",
    ]);
    expect(rows.map((row) => (row.kind === "node" ? row.level : null))).toEqual([0, 1, 1, 2, 0]);
  });
});

describe("resolveTreeListKeyboardNavigation", () => {
  it("moves focus through visible tree rows with vertical arrows", () => {
    const rows = buildVirtualRows(sections, [], ["folder:src"]);

    expect(
      resolveTreeListKeyboardNavigation({
        rows,
        focusedRowId: "folder:src",
        expandedNodeIds: ["folder:src"],
        key: "ArrowDown",
      }),
    ).toEqual({ type: "focus", rowId: "file:src/a.ts" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows,
        focusedRowId: "file:src/a.ts",
        expandedNodeIds: ["folder:src"],
        key: "ArrowUp",
      }),
    ).toEqual({ type: "focus", rowId: "folder:src" });
  });

  it("expands, enters, and leaves branches with horizontal arrows", () => {
    const collapsedRows = buildVirtualRows(sections, [], []);
    const expandedRows = buildVirtualRows(sections, [], ["folder:src"]);

    expect(
      resolveTreeListKeyboardNavigation({
        rows: collapsedRows,
        focusedRowId: "folder:src",
        expandedNodeIds: [],
        key: "ArrowRight",
      }),
    ).toEqual({ type: "toggle-node", nodeId: "folder:src" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows: expandedRows,
        focusedRowId: "folder:src",
        expandedNodeIds: ["folder:src"],
        key: "ArrowRight",
      }),
    ).toEqual({ type: "focus", rowId: "file:src/a.ts" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows: expandedRows,
        focusedRowId: "file:src/a.ts",
        expandedNodeIds: ["folder:src"],
        key: "ArrowLeft",
      }),
    ).toEqual({ type: "focus", rowId: "folder:src" });
  });

  it("moves focus between section headers and nodes with vertical arrows", () => {
    const rows = buildVirtualRows(labeledSections, ["open", "files"], []);

    expect(
      resolveTreeListKeyboardNavigation({
        rows,
        focusedRowId: "header:open",
        expandedNodeIds: [],
        key: "ArrowDown",
      }),
    ).toEqual({ type: "focus", rowId: "file:open/x.ts" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows,
        focusedRowId: "file:open/x.ts",
        expandedNodeIds: [],
        key: "ArrowUp",
      }),
    ).toEqual({ type: "focus", rowId: "header:open" });
  });

  it("toggles and enters sections from a focused section header", () => {
    const collapsedRows = buildVirtualRows(labeledSections, [], []);
    const expandedRows = buildVirtualRows(labeledSections, ["open", "files"], []);

    expect(
      resolveTreeListKeyboardNavigation({
        rows: collapsedRows,
        focusedRowId: "header:open",
        expandedNodeIds: [],
        key: "ArrowRight",
      }),
    ).toEqual({ type: "toggle-section", sectionId: "open" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows: expandedRows,
        focusedRowId: "header:open",
        expandedNodeIds: [],
        key: "ArrowRight",
      }),
    ).toEqual({ type: "focus", rowId: "file:open/x.ts" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows: expandedRows,
        focusedRowId: "header:open",
        expandedNodeIds: [],
        key: "ArrowLeft",
      }),
    ).toEqual({ type: "toggle-section", sectionId: "open" });
    expect(
      resolveTreeListKeyboardNavigation({
        rows: expandedRows,
        focusedRowId: "header:open",
        expandedNodeIds: [],
        key: "Enter",
      }),
    ).toEqual({ type: "toggle-section", sectionId: "open" });
  });
});
