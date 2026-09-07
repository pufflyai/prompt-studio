import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { resolveTreeListSelection } from "../../react/renderers/tree/tree-list-adapter";
import type { InternalWorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";

const treeId = "pstdio.lab.view.files";

const metadata: InternalWorkbenchExtensionMetadata = {
  extensions: [],
  commands: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  pages: [],
  placements: [],
  panels: [],
  resourceKinds: [],
  resourceHierarchyProviders: [],
  settingsSections: [],
  settingsPanels: [],
  kanbanRenderers: [],
  dataTableRenderers: [],
  commandPaletteResources: [],
  treeRenderers: [
    {
      id: treeId,
      extensionId: "pstdio.lab",
      title: "Files",
      bodyHandlerId: "pstdio.lab.tree.body",
      childrenHandlerId: "pstdio.lab.tree.children",
    },
  ],
  fileRenderers: [],
  controlsRenderers: [],
  keybindings: [],
  settingsDefinitions: [],
  statuses: [],
  statusBarItems: [],
  diagnostics: [],
};

describe("extension tree renderer contributions", () => {
  test.each([
    "body",
    "first-file",
    "second-file",
  ])("preserves the declared document selection in a composed navigation tree: %s", async (documentId) => {
    const workbench = createWorkbench();
    const page = { kind: "page", extensionId: "pstdio.lab", id: "ticket" } as const;
    const resource = { type: "ticket", id: "ticket-1", metadata: { documentId } };
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: () => [
            {
              id: "documents",
              nodes: ["body", "first-file", "second-file"].map((id) => ({
                id,
                label: id,
                selected: id === documentId,
                target: { kind: "page", page, resource: { ...resource, metadata: { documentId: id } } },
              })),
            },
          ],
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    workbench.navigationTrees.registerContribution({
      id: "files",
      idScope: "files",
      owner: page,
      sourceExtensionId: "pstdio.lab",
      declarationIndex: 0,
      viewId: treeId,
    });
    const sections = await workbench.navigationTrees.getSections(page, "content", { resource });
    expect(
      resolveTreeListSelection({
        sections,
        childrenByNodeId: {},
        activeLocation: { page, resource },
        activeResource: resource,
        selectedNodeId: "session:previous",
      }),
    ).toBe(`files:${documentId}`);
  });
  test("does not send host-owned nodes to the extension children handler", async () => {
    const workbench = createWorkbench();
    const calls: string[] = [];
    workbench.registerModule({
      id: "test.extension-tree",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: (commandId) => {
            calls.push(commandId);
            return [];
          },
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    const hostChild = { id: "host-child", label: "Host child" };

    const children = await getWorkbenchRenderers(workbench).getChildren(treeId, {
      id: "host",
      label: "Host",
      children: [hostChild],
    });

    expect(children).toEqual([hostChild]);
    expect(calls).toEqual([]);
  });
});
