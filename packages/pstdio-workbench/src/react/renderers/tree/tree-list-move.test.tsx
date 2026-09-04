import { describe, expect, mock, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers, type ResourceRef, type TreeNode } from "../../../core";
import { toTreeListSection } from "./tree-list-adapter";
import { createMoveTreeNode } from "./tree-view-move";

const resource = {
  kind: "workspace",
  id: "workspace-1",
  uri: "pstdio://workspace/workspace-1",
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
