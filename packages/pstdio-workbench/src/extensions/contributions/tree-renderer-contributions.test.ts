import { describe, expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
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
