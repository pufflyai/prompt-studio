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
    { id: "pstdio.lab.command.focus", extensionId: "pstdio.lab", title: "Focus lab" },
    { id: "pstdio.lab.command.search", extensionId: "pstdio.lab", title: "Search lab resources" },
    { id: "pstdio.lab.view.tree.tree.body", extensionId: "pstdio.lab", title: "List lab tree" },
  ],
  menuContributions: [
    {
      id: "lab.focus.header",
      extensionId: "pstdio.lab",
      commandId: "pstdio.lab.command.focus",
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
      queryHandlerId: "pstdio.lab.command.search",
    },
  ],
  modes: [
    {
      id: "pstdio.lab.mode.review",
      localId: "review",
      extensionId: "pstdio.lab",
      label: "Review",
    },
  ],
  views: [
    {
      id: "pstdio.lab.view.tree",
      localId: "tree",
      extensionId: "pstdio.lab",
      title: "Lab tree",
      body: {
        kind: "tree",
        bodyHandlerId: "pstdio.lab.view.tree.tree.body",
        defaultExpandedSectionIds: ["workflows"],
      },
    },
  ],
  viewMenus: [],
  placements: [
    {
      id: "pstdio.lab.placement.tree",
      localId: "tree",
      extensionId: "pstdio.lab",
      mode: { kind: "mode", id: "review", extensionId: "pstdio.lab" },
      item: {
        kind: "view",
        view: { kind: "view", id: "tree", extensionId: "pstdio.lab" },
      },
      region: "sidenav",
      required: true,
    },
  ],
  resourceKinds: [],
  resourceViews: [],
  navigationItems: [],
  statusBarItems: [],
  statuses: [],
  commandPaletteContributions: [],
  diagnostics: [],
  settingsPanels: [],
} satisfies WorkbenchExtensionMetadata;

export const createExtensionModule = (): WorkbenchModuleContribution => ({
  id: "docs.extension-host",
  activate(ctx) {
    return registerWorkbenchExtensionContributions({
      executeCommand: (commandId: string, body: CommandExecuteRequest) => {
        if (commandId === "pstdio.lab.view.tree.tree.body") {
          return [{ id: "workflows", label: "Workflows", nodes: [] }];
        }
        if (commandId === "pstdio.lab.command.search") {
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
