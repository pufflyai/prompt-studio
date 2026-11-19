import { defineExtension, defineStatusBarItem, defineView, packageAsset, workbenchSlots } from "@pstdio/sdk/extensions";

const control = defineView({
  id: "control",
  title: "Render highlight control",
  body: {
    kind: "webview",
    entry: packageAsset("./view.ts", import.meta.url),
    capabilities: ["performance.control"],
  },
});

export default defineExtension({
  views: [control],
  statusBarItems: [defineStatusBarItem({ id: "highlights", view: control.ref, slot: workbenchSlots.statusBarLeading })],
});
