import { describe, expect, mock, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers, type ResourceRef, type TreeNode } from "../../../core";
import { toTreeListSection } from "./tree-list-adapter";
import { canMoveTreeNode, createMoveTreeNode } from "./tree-view-move";

const resource = {
  type: "workspace",
  id: "workspace-1",
} satisfies ResourceRef;
const folder = { id: "docs", label: "docs", collapsible: true, canDrop: true } satisfies TreeNode;
const file = { id: "README.md", label: "README.md", canDrag: true } satisfies TreeNode;
describe("movable tree nodes", () => {
  test("maps drag and drop capabilities onto tree list rows", () => {
    const workbench = createWorkbench();
    const section = toTreeListSection({ id: "files", nodes: [folder, file] }, {}, { workbench });
    expect(section.nodes[0]).toMatchObject({ id: "docs", canDrop: true });
    expect(section.nodes[1]).toMatchObject({ id: "README.md", canDrag: true });
  });
  test("resolves source and target nodes before moving", () => {
    const workbench = createWorkbench();
    const moveNode = mock();
    workbench.views.registerView({
      id: "files",
      title: "Files",
      body: { kind: "tree", getBody: () => [], getChildren: () => [], moveNode },
    });
    const renderer = getWorkbenchRenderers(workbench).getTreeRenderer("files")!;
    const move = createMoveTreeNode({
      workbench,
      renderer,
      resource,
      sections: [{ id: "files", nodes: [folder, file] }],
      childrenByNodeId: {},
    });
    move?.("README.md", "docs");
    expect(moveNode).toHaveBeenCalledWith(
      file,
      folder,
      expect.objectContaining({ resource, viewId: undefined, state: expect.any(Object) }),
    );
  });
});

test("rejects resource previews across contributions that share navigation arrangement scope", async () => {
  const workbench = createWorkbench();
  const owner = { kind: "mode" as const, extensionId: "host", id: "project" };
  for (const id of ["notes", "files"]) {
    workbench.navigationTrees.registerContribution({
      id,
      idScope: id,
      owner,
      sourceExtensionId: id,
      declarationIndex: 0,
      getSections: () => [{ id: "root", nodes: [file, folder] }],
    });
  }
  const sections = await workbench.navigationTrees.getSections(owner);
  const context = { sections, childrenByNodeId: {} };
  expect(canMoveTreeNode(context, "notes:README.md", "notes:docs")).toBe(true);
  expect(canMoveTreeNode(context, "notes:README.md", "files:docs")).toBe(false);
});
