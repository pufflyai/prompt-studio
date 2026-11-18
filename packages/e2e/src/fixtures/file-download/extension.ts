import { defineExtension, definePage, defineView, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";

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
export default defineExtension({ views: [view], pages: [page] });
