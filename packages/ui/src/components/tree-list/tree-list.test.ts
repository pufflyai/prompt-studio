import { describe, expect, it } from "bun:test";
import { buildVirtualRows } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

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
