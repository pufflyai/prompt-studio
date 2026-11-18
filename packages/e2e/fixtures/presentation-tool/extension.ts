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
const home = page("welcome", "desk");
const workspaces = page("catalog", "collection");
const inspect = definePage({
  id: "inspect",
  path: "reading-room",
  title: "Alternative resource viewer",
  mode: workbenchModes.project,
  parent: workspaces.ref,
  resource: { kinds: [workbenchResourceKinds.workspace] },
  document: { metadataKey: "workspaceFilePath" },
  main: { kind: "view", view: view.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export default defineExtension({
  views: [view],
  pages: [home, workspaces, inspect],
  commands: [
    defineCommand({
      id: "inspect-record",
      title: "Inspect a resource",
      cli: true,
      run: (ctx) => ({ kind: "page", page: inspect.ref, resource: ctx.resource }),
    }),
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
