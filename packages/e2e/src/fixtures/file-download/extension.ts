import {
  defineExtension,
  defineMode,
  definePage,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const view = defineView({
  id: "download",
  title: "Download page",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url), capabilities: ["files.download"] },
});
const page = definePage({
  id: "download",
  path: "download",
  title: "Download page",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
const resource = defineResourceKind({ id: "export", label: "Export document" });
const actions = defineView({
  id: "actions",
  title: "Export actions",
  body: {
    kind: "actionBar",
    query: () => ({
      items: [{ id: "document", label: "Document actions", icon: "Ellipsis", items: [], includeResourceActions: true }],
    }),
  },
});
const mode = defineMode({ id: "export", label: "Export", regions: ["main"], chrome: { activity: actions.ref } });
const exportView = defineView({
  id: "export",
  title: "SVG export",
  body: {
    kind: "webview",
    entry: packageAsset("./export-view.ts", import.meta.url),
    capabilities: ["files.save", "resources.actions.register"],
  },
});
const exportHome = definePage({
  id: "export-home",
  path: "exports",
  title: "Exports",
  mode: mode.ref,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
const exportPage = definePage({
  id: "export",
  path: "export",
  title: "Export document",
  mode: mode.ref,
  parent: exportHome.ref,
  resource: { kinds: [resource.ref] },
  main: { kind: "view", view: exportView.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({
  resourceKinds: [resource],
  modes: [mode],
  views: [view, actions, exportView],
  pages: [page, exportHome, exportPage],
});
