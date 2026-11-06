import {
  defineExtension,
  defineKeybinding,
  defineNavigationItem,
  defineViewMenu,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { filesTree, fileView } from "./src/files";
import { openFiles } from "./src/navigation";
import { action, devicePage, files, history, overview, workspace, workspaces } from "./src/pages";
import { fileSearch } from "./src/search";
import { capacitySettings, capacityView } from "./src/settings";
import { actionView, changesView, historyView, summaryView, workspacesView } from "./src/views";

const target = { kind: "page" as const, page: workspaces.ref };
export default defineExtension({
  commands: Object.values(commands),
  commandPaletteResources: [fileSearch],
  views: [fileView, filesTree, workspacesView, historyView, summaryView, changesView, actionView, capacityView],
  pages: [workspaces, workspace, files, history, overview, action, devicePage],
  viewMenus: [defineViewMenu({ id: "file-tree", owner: fileView.ref, view: filesTree.ref, side: "left" })],
  settings: {
    properties: { deviceLimits: { type: "object", title: "Last known device limits", default: {}, scope: "device" } },
  },
  settingsPanels: [capacitySettings],
  navigationItems: [
    defineNavigationItem({
      id: "files",
      label: "Files",
      icon: "files",
      owner: workbenchModes.project,
      slot: "content",
      group: "Project Workspaces",
      action: { kind: "command", target: { command: openFiles.ref } },
    }),
    defineNavigationItem({
      id: "workspaces",
      label: "Workspaces",
      icon: "folder-git-2",
      owner: workbenchModes.project,
      slot: "content",
      group: "Project Workspaces",
      action: target,
    }),
  ],
  keybindings: [
    defineKeybinding({ id: "go-workspaces", layer: "go", key: "W", sticky: true, action: target }),
    defineKeybinding({
      id: "new-workspace",
      layer: "create",
      key: "W",
      action: { kind: "command", target: { command: commands["show-create"].ref } },
    }),
  ],
});
