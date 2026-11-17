import {
  defineExtension,
  defineMode,
  definePage,
  defineStatusBarItem,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const mode = defineMode({
  id: "isolated",
  label: "Isolated mode",
  regions: ["main", "side"],
  chrome: { sidenav: false },
});
const view = defineView({
  id: "content",
  title: "Mode content",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url) },
});
const status = defineView({
  id: "status",
  title: "Mode status",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url) },
});
const page = definePage({
  id: "mode",
  path: "mode",
  title: "Mode page",
  mode: mode.ref,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({
  modes: [mode],
  views: [view, status],
  pages: [page],
  statusBarItems: [
    defineStatusBarItem({
      id: "status",
      view: status.ref,
      slot: workbenchSlots.statusBarLeading,
      when: { mode: mode.ref },
    }),
  ],
});
