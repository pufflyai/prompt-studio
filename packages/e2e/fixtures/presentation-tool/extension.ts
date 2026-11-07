import {
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineSettingsPanel,
  defineStatusBarItem,
  defineView,
  packageAsset,
  workbenchModes,
  workbenchResourceKinds,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const view = defineView({
  id: "surface",
  title: "Alternative presentation",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["account.read"] },
});
const page = (id: string, path: string) =>
  definePage({
    id,
    path,
    title: `Alternative ${path}`,
    mode: workbenchModes.project,
    main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
    slots: [],
  });
const home = page("welcome", "home");
const workspaces = page("browse", "workspaces");
const children = ["workspace", "files", "history", "overview"].map((path) =>
  definePage({
    id: `show-${path}`,
    path,
    title: `Alternative ${path}`,
    mode: workbenchModes.project,
    parent: workspaces.ref,
    resource: { kinds: [workbenchResourceKinds.workspace] },
    document: { metadataKey: "workspaceFilePath" },
    main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
    slots: [],
  }),
);
export default defineExtension({
  views: [view],
  pages: [home, workspaces, ...children],
  commands: [
    defineCommand({
      id: "open",
      title: "Alternative workspaces",
      run: (ctx) => ctx.navigation.open({ kind: "page", page: workspaces.ref }),
    }),
  ],
  navigationItems: [home, workspaces].map((destination) =>
    defineNavigationItem({
      id: destination.id,
      label: `Alternative ${destination.path}`,
      owner: workbenchModes.project,
      slot: "header",
      action: { kind: "page", page: destination.ref },
    }),
  ),
  statusBarItems: [defineStatusBarItem({ id: "cloud", view: view.ref, slot: workbenchSlots.statusBarTrailing })],
  settingsPanels: [defineSettingsPanel({ id: "cloud", view: view.ref, slot: workbenchSlots.globalSettings })],
});
