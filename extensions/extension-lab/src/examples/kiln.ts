import { defineExtension, definePlacement, defineStatusBarItem, workbenchSlots } from "@pstdio/sdk/extensions";
import { definePageExample, webview } from "../definition";

const views = [
  webview("kiln-viewport", "3D viewport"),
  webview("kiln-inspector", "Scene and properties"),
  webview("kiln-timeline", "Timeline"),
  webview("kiln-nav", "Kiln project"),
  webview("kiln-status", "Scene status"),
];
const example = definePageExample({
  name: "kiln",
  label: "Kiln",
  icon: "Box",
  primary: views[0].ref,
  params: { selection: { type: "string" } },
  chrome: { nav: views[3].ref, sidenav: false, activity: false },
  regionSettings: {
    side: {
      size: { defaultPx: 340, minPx: 300, maxPx: 440 },
      canClose: false,
      alwaysShowTabs: false,
      floatable: false,
    },
    secondary: { size: { defaultPx: 188, minPx: 188, maxPx: 188 }, canClose: false, showHeader: false },
  },
  slots: [
    {
      id: "inspector",
      region: "side",
      item: {
        kind: "view",
        view: views[1].ref,
        presence: "open",
      },
    },
  ],
});
export default defineExtension({
  statusBarItems: [
    defineStatusBarItem({
      id: "kiln-scene",
      view: views[4].ref,
      slot: workbenchSlots.statusBarLeading,
      when: { mode: example.mode.ref },
    }),
  ],
  placements: [
    definePlacement({
      id: "kiln-timeline",
      mode: example.mode.ref,
      region: "secondary",
      item: { kind: "view", view: views[2].ref, presence: "fixed" },
    }),
  ],
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
