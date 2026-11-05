import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { previewTreeResources } from "../../react/renderers/tree/tree-resource-preview";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

test("loaded-child previews preserve extension callbacks for other folders", async () => {
  const workbench = createWorkbench();
  const folder = { id: "folder", label: "Folder", collapsible: true, canDrop: true };
  const file = { id: "file", label: "File", canDrag: true };
  const calls: unknown[] = [];
  workbench.registerModule({
    id: "previewed-files",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        metadata: {
          ...metadata,
          treeRenderers: [{ ...metadata.treeRenderers[0]!, moveHandlerId: "pstdio.lab.tree.move" }],
        },
        projectId: "project-1",
        workbench: context,
        executeCommand: (id, request) => {
          calls.push({ id, params: request.params });
          if (id === "pstdio.lab.tree.children") return [{ id: "folder/child", label: "Child" }];
          if (id === "pstdio.lab.tree.move") return;
          return [{ id: "files", nodes: [folder, file] }];
        },
      }),
  });
  const trees = getWorkbenchRenderers(workbench);
  const sections = await trees.getBody(treeId);
  const preview = previewTreeResources(sections, { loaded: [] }, new Map());
  const [projectedFolder, projectedFile] = preview[0]!.nodes;
  expect(projectedFolder).not.toBe(sections[0]!.nodes[0]);
  expect(await trees.getChildren(treeId, projectedFolder!)).toMatchObject([{ id: "folder/child" }]);
  await trees.getTreeRenderer(treeId)!.moveNode!(projectedFile!, projectedFolder!, {
    state: trees.getTreeState(treeId),
    refresh: () => {},
    setSelectedNode: () => {},
  });
  expect(calls).toContainEqual(
    expect.objectContaining({
      id: "pstdio.lab.tree.move",
      params: expect.objectContaining({ source: file, target: folder }),
    }),
  );
});

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
  await workbench.navigationTrees.moveNode(
    { ...source! },
    { ...target! },
    {
      position: "inside",
      resource: { type: "workspace", id: "other-workspace" },
    },
  );
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

test("tree callbacks reject clones belonging to a different mapper with the same node IDs", async () => {
  const workbench = createWorkbench();
  const calls: string[] = [];
  workbench.registerModule({
    id: "independent-trees",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        metadata: {
          ...metadata,
          treeRenderers: ["first", "second"].map((id) => ({
            ...metadata.treeRenderers[0]!,
            id,
            moveHandlerId: "pstdio.lab.tree.move",
          })),
        },
        projectId: "project-1",
        workbench: context,
        executeCommand: (id) => {
          calls.push(id);
          return [{ id: "files", nodes: [{ id: "same", label: "Same", canDrag: true, canDrop: true }] }];
        },
      }),
  });
  const trees = getWorkbenchRenderers(workbench);
  const sections = await trees.getBody("first");
  const cloned = { ...sections[0]!.nodes[0]! };
  const before = calls.length;
  expect(await trees.getChildren("second", cloned)).toEqual([]);
  await trees.getTreeRenderer("second")!.moveNode!(cloned, cloned, {
    state: trees.getTreeState("second"),
    refresh: () => {},
    setSelectedNode: () => {},
  });
  expect(calls).toHaveLength(before);
});

test("extension tree reads refresh when the selected document changes within one workspace", () => {
  const workbench = createWorkbench();
  workbench.registerModule({
    id: "document-context",
    activate: (context) =>
      registerWorkbenchExtensionTreeRenderers({
        metadata,
        projectId: "project-1",
        workbench: context,
        executeCommand: () => [],
      }),
  });
  const renderer = getWorkbenchRenderers(workbench).getTreeRenderer(treeId)!;
  const resource = { type: "workspace", id: "workspace", extensionId: "pstdio", projectId: "project-1" };
  const before = renderer.getReadKey!({ resource: { ...resource, metadata: { workspaceFilePath: "old.txt" } } });
  const after = renderer.getReadKey!({
    resource: { ...resource, metadata: { workspaceFilePath: "folder/selected.txt" } },
  });
  expect(after).not.toBe(before);
});
