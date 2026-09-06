import { defineExtension } from "@pstdio/sdk/extensions";
import { defineExample, webview } from "../definition";

const views = [
  webview("scribble-document", "Document"),
  webview("scribble-pages", "Pages"),
  webview("scribble-status", "Sync status"),
];
export const example = defineExample({
  name: "scribble",
  label: "Scribble",
  icon: "Feather",
  primary: views[0].ref,
  chrome: { sidenav: views[1].ref, activity: false, status: views[2].ref },
  regionSettings: { sidenav: { size: { defaultPx: 240, minPx: 200, maxPx: 320 }, collapsible: false } },
  slots: [],
  initialResource: true,
});
export default defineExtension({
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.homePage, example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
