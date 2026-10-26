import { defineExtension, definePlacement, defineStatusBarItem, workbenchSlots } from "@pstdio/sdk/extensions";
import { defineExample, webview } from "../definition";

const views = [
  webview("kiln-viewport", "3D viewport"),
  webview("kiln-inspector", "Scene and properties"),
  webview("kiln-timeline", "Timeline"),
  webview("kiln-nav", "Kiln project"),
  webview("kiln-status", "Scene status"),
];
const example = defineExample({
  name: "kiln",
  label: "Kiln",
  icon: "Box",
  primary: views[0].ref,
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
      openOn: "page-resource",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "kiln.object" }],
          view: views[1].ref,
          cardinality: "one",
        },
      },
    },
  ],
  initialResource: true,
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
  pages: [example.homePage, example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
