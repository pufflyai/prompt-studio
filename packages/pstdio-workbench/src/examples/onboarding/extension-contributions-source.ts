export const extensionContributionsSource = `import type {
  CommandExecuteRequest,
  WorkbenchExtensionMetadata,
} from "@pstdio/sdk/api";
import {
  headerTrailingMenuPath,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";
import { registerWorkbenchExtensionContributions } from "@pstdio/workbench/extensions";

const metadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "" }],
  commands: [
    { id: "lab.focus", extensionId: "pstdio.lab", title: "Focus lab" },
    { id: "lab.search", extensionId: "pstdio.lab", title: "Search lab resources" },
  ],
  menuContributions: [
    {
      id: "lab.focus.header",
      extensionId: "pstdio.lab",
      commandId: "lab.focus",
      slotId: "main.header",
      label: "Lab action",
    },
  ],
  commandPaletteResources: [
    {
      id: "lab.resources",
      extensionId: "pstdio.lab",
      title: "Lab resources",
      resourceKind: "lab.resource",
      queryCommandId: "lab.search",
    },
  ],
  treeRenderers: [
    {
      id: "lab.tree",
      extensionId: "pstdio.lab",
      title: "Lab tree",
      bodyHandlerId: "lab.treeBody",
      defaultExpandedSectionIds: ["workflows"],
    },
  ],
  panels: [
    {
      id: "lab.treePanel",
      extensionId: "pstdio.lab",
      title: "Lab tree",
      region: "sidenav",
      closable: false,
      treeRendererId: "lab.tree",
    },
  ],
  commandPaletteContributions: [],
  diagnostics: [],
  modes: [],
  navigation: [],
  routes: [],
  settingsPanels: [],
} satisfies WorkbenchExtensionMetadata;

export const createExtensionModule = (): WorkbenchModuleContribution => ({
  id: "docs.extension-host",
  activate(ctx) {
    return registerWorkbenchExtensionContributions({
      executeCommand: (commandId: string, body: CommandExecuteRequest) => {
        if (commandId === "lab.treeBody") {
          return [{ id: "workflows", label: "Workflows", nodes: [] }];
        }
        if (commandId === "lab.search") {
          return { items: [] };
        }
        return undefined;
      },
      menuSlotsById: new Map([
        ["main.header", { menuPath: headerTrailingMenuPath("main") }],
      ]),
      metadata,
      projectId: "project-1",
      workbench: ctx,
    });
  },
});`;
