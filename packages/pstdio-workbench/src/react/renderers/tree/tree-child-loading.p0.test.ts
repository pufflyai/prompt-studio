import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers, type TreeNode, type TreeViewSection } from "../../../core";
import { loadTreeNodeChildren } from "./tree-child-loading";
import { previewTreeMove } from "./tree-move-preview";

for (const cachedEmpty of [false, true]) {
  test(`expanding a move preview reads the complete destination${cachedEmpty ? " after a cached empty read" : ""}`, async () => {
    const workbench = createWorkbench();
    const source = {
      id: "source",
      label: "Source",
      canDrag: true,
      children: [{ id: "source/keep.txt", label: "keep.txt" }],
    };
    const destination = { id: "destination", label: "Destination", canDrop: true, collapsible: true };
    const sections: TreeViewSection[] = [{ id: "files", nodes: [source, destination] }];
    let children: (typeof source)[] = [];
    let reads = 0;
    const trees = getWorkbenchRenderers(workbench);
    trees.registerTreeRenderer({
      id: "files",
      title: "Files",
      getBody: () => sections,
      getChildren: () => {
        reads++;
        return children;
      },
    });
    const cached: Record<string, TreeNode[]> = cachedEmpty
      ? { destination: await trees.getChildren("files", destination) }
      : {};
    const preview = previewTreeMove(sections, cached, {
      sourceId: "source",
      targetId: "destination",
      position: "inside",
    });
    const projected = preview[0]!.nodes[0]!;
    expect(projected.children).toEqual([source]);
    children = [{ id: "existing", label: "Existing", canDrag: true, children: [] }, source];
    const before = reads;
    expect(await loadTreeNodeChildren(trees, "files", projected, {}, sections)).toEqual(children);
    expect(reads).toBe(before + 1);
    // A subsequent authoritative body replaces the optimistic node, without losing its expanded contents.
    expect(await loadTreeNodeChildren(trees, "files", destination, {}, sections)).toEqual(children);
  });
}

test("a preview absent from the provider snapshot delegates its child read", async () => {
  const workbench = createWorkbench();
  const trees = getWorkbenchRenderers(workbench);
  const complete = [
    { id: "existing", label: "Existing" },
    { id: "moving", label: "Moving" },
  ];
  let reads = 0;
  trees.registerTreeRenderer({
    id: "files",
    title: "Files",
    getBody: () => [],
    getChildren: () => {
      reads++;
      return complete;
    },
  });
  const preview = { id: "unloaded/destination", label: "Destination", children: [complete[1]!] };
  expect(await loadTreeNodeChildren(trees, "files", preview, {}, [])).toEqual(complete);
  expect(reads).toBe(1);
});
