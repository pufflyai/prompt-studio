import { expect, test } from "bun:test";
import type { TreeViewSection } from "../../../core";
import { previewTreeMove } from "./tree-move-preview";

const first = { id: "first", label: "First", canDrag: true, canDrop: true };
const second = { id: "second", label: "Second", canDrag: true, canDrop: true };
const sections: TreeViewSection[] = [
  {
    id: "navigation",
    nodes: [
      {
        id: "notes",
        label: "Notes",
        canDrop: true,
        children: [{ id: "folder", label: "Folder", canDrop: true, children: [] }, first, second],
      },
      { id: "workspaces", label: "Workspaces" },
    ],
  },
];

test("previews before and after without mutating the saved snapshot or leaf identities", () => {
  const moved = previewTreeMove(sections, {}, { sourceId: "first", targetId: "second", position: "after" });
  expect(moved[0].nodes[0].children!.map((node) => node.id)).toEqual(["folder", "second", "first"]);
  expect(moved[0].nodes[0].children!.at(-1)).toBe(first);
  expect(sections[0].nodes[0].children!.map((node) => node.id)).toEqual(["folder", "first", "second"]);
  const restored = previewTreeMove(moved, {}, { sourceId: "first", targetId: "second", position: "before" });
  expect(restored[0].nodes[0].children!.map((node) => node.id)).toEqual(["folder", "first", "second"]);
});

test("previews folder membership with loaded children, then a move back to the root", () => {
  const moved = previewTreeMove(sections, {}, { sourceId: "first", targetId: "folder", position: "inside" });
  expect(moved[0].nodes[0].children![0].children).toEqual([first]);
  expect(moved[0].nodes[0].children!.map((node) => node.id)).toEqual(["folder", "second"]);
  const restored = previewTreeMove(moved, {}, { sourceId: "first", targetId: "notes", position: "inside" });
  expect(restored[0].nodes[0].children!.at(-1)).toBe(first);
  const lazy: TreeViewSection[] = [{ id: "files", nodes: [{ id: "folder", label: "Folder", canDrop: true }] }];
  const result = previewTreeMove(
    lazy,
    { folder: [first, second] },
    { sourceId: "first", targetId: "second", position: "after" },
  );
  expect(result[0].nodes[0].children).toEqual([second, first]);
});

test("leaves invalid or forbidden drops unchanged", () => {
  for (const targetId of ["first", "workspaces", "missing"]) {
    expect(previewTreeMove(sections, {}, { sourceId: "first", targetId, position: "inside" })).toBe(sections);
  }
  expect(previewTreeMove(sections, {}, { sourceId: "folder", targetId: "first", position: "after" })).toBe(sections);
});

test("preserves loaded descendants when moving a folder and rejects cycles", () => {
  const folder = { id: "folder", label: "Folder", canDrag: true, canDrop: true, collapsible: true };
  const destination = { id: "destination", label: "Destination", canDrop: true, children: [] };
  const sections: TreeViewSection[] = [{ id: "files", nodes: [folder, destination] }];
  const children = { folder: [first] };
  const moved = previewTreeMove(sections, children, {
    sourceId: "folder",
    targetId: "destination",
    position: "inside",
  });
  expect(moved[0].nodes[0].children![0].children).toEqual([first]);
  expect(previewTreeMove(sections, children, { sourceId: "folder", targetId: "first", position: "before" })).toBe(
    sections,
  );
});
