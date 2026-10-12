import { expect, test } from "bun:test";
import { treeSelectionAncestors } from "./tree-selection-ancestors";

test("reveals only ancestors of the selected note, including a collapsed folder", () => {
  const sections = [
    {
      id: "navigation",
      nodes: [
        {
          id: "notes",
          label: "Notes",
          children: [
            { id: "folder", label: "Ideas", children: [{ id: "note", label: "New note" }] },
            { id: "other", label: "Other", children: [{ id: "other-note", label: "Other note" }] },
          ],
        },
      ],
    },
  ];
  expect(treeSelectionAncestors(sections, {}, ["note"])).toEqual({
    nodes: ["notes", "folder"],
    sections: ["navigation"],
  });
  expect(treeSelectionAncestors(sections, {}, ["unloaded"])).toBeUndefined();
});
