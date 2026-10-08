import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

test("routes projected sidebar drops to the owning extension with original node identities", async () => {
  const workbench = createWorkbench();
  const calls: unknown[] = [];
  const originalSource = { id: "note-1", label: "First", canDrag: true };
  const originalTarget = { id: "folder:ideas", label: "Ideas", canDrop: true };
  const resource = { type: "workspace", id: "notes-workspace" };
  workbench.registerModule({
    id: "notes-movement",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        metadata: {
          ...metadata,
          treeRenderers: [
            { ...metadata.treeRenderers[0]!, childrenHandlerId: undefined, moveHandlerId: "pstdio.lab.tree.move" },
          ],
        },
        projectId: "project-1",
        workbench: context,
        executeCommand: (id, request) => {
          if (id === "pstdio.lab.tree.move") calls.push(request.params);
          else return [{ id: "notes", nodes: [originalSource, originalTarget] }];
        },
      }),
  });
  const owner = { kind: "mode", id: "project", extensionId: "pstdio" } as const;
  workbench.navigationTrees.registerContribution({
    id: "notes",
    idScope: treeId,
    owner,
    sourceExtensionId: "pstdio.lab",
    declarationIndex: 0,
    viewId: treeId,
    resolveResource: () => resource,
  });
  const [section] = await workbench.navigationTrees.getSections(owner);
  const [source, target] = section!.nodes;
  expect(source!.id).toBe(`${treeId}:note-1`);
  await workbench.navigationTrees.moveNode(source!, target!, {
    position: "inside",
    resource: { type: "workspace", id: "other-workspace" },
  });
  expect(calls).toMatchObject([
    {
      source: originalSource,
      target: originalTarget,
      position: "inside",
      renderer: { projectId: "project-1", resource },
    },
  ]);
  expect(getWorkbenchRenderers(workbench).getTreeRenderer(treeId)?.moveNode).toBeDefined();
  // Independent trees cannot receive each other's resource drops.
  workbench.navigationTrees.registerContribution({
    id: "other",
    owner,
    sourceExtensionId: "other",
    declarationIndex: 0,
    getSections: () => [{ id: "other", nodes: [{ id: "external", label: "External", canDrop: true }] }],
  });
  const sections = await workbench.navigationTrees.getSections(owner);
  const nodes = sections.flatMap((section) => section.nodes);
  await workbench.navigationTrees.moveNode(
    nodes.find((node) => node.id.endsWith("note-1"))!,
    nodes.find((node) => node.id === "external")!,
  );
  expect(calls).toHaveLength(1);
  await workbench.navigationTrees.moveNode(nodes.find((node) => node.id.endsWith("note-1"))!, undefined);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatchObject({ source: originalSource, target: undefined });
  await workbench.navigationTrees.moveNode(
    nodes.find((node) => node.id.endsWith("note-1"))!,
    nodes.find((node) => node.id.endsWith("folder:ideas"))!,
    { position: "after" },
  );
  expect(calls[2]).toMatchObject({ source: originalSource, target: originalTarget, position: "after" });
});
