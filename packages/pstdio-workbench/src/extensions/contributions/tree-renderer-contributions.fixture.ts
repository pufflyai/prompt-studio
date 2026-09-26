import type { InternalWorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";

export const treeId = "pstdio.lab.view.files";

export const metadata: InternalWorkbenchExtensionMetadata = {
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
