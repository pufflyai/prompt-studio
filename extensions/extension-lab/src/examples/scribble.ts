import { defineExtension, defineStatusBarItem, workbenchSlots } from "@pstdio/sdk/extensions";
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
  regions: ["main", "side"],
  chrome: { sidenav: views[1].ref, activity: false },
  regionSettings: { sidenav: { size: { defaultPx: 240, minPx: 200, maxPx: 320 }, canClose: false } },
  slots: [],
  initialResource: true,
});
export default defineExtension({
  statusBarItems: [
    defineStatusBarItem({
      id: "scribble-sync",
      view: views[2].ref,
      slot: workbenchSlots.statusBarTrailing,
      when: { mode: example.mode.ref },
    }),
  ],
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.homePage, example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
