import { defineExtension, defineKeybinding, defineViewMenu, packageAsset } from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { filesTree, fileView } from "./src/files";
import { action, createPage, devicePage, files, history, overview, workspace, workspaces } from "./src/pages";
import { fileSearch } from "./src/search";
import { capacitySettings, capacityView } from "./src/settings";
import { sidebar, sidebarView } from "./src/sidebar";
import { actionView, changesView, historyView, summaryView, workspacesView } from "./src/views";

const target = { kind: "page" as const, page: workspaces.ref };
export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  commands: Object.values(commands),
  commandPaletteResources: [fileSearch],
  views: [
    fileView,
    filesTree,
    workspacesView,
    historyView,
    summaryView,
    changesView,
    actionView,
    capacityView,
    sidebarView,
  ],
  pages: [workspaces, workspace, files, history, overview, action, createPage, devicePage],
  viewMenus: [defineViewMenu({ id: "file-tree", owner: fileView.ref, view: filesTree.ref, side: "left" })],
  settings: {
    properties: { deviceLimits: { type: "object", title: "Last known device limits", default: {}, scope: "device" } },
  },
  settingsPanels: [capacitySettings],
  navigationTrees: [sidebar],
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
