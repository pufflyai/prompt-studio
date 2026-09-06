import { defineExtension, definePlacement } from "@pstdio/sdk/extensions";
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
  chrome: { nav: views[3].ref, sidenav: false, activity: false, status: views[4].ref },
  regionSettings: {
    side: { size: { defaultPx: 340, minPx: 300, maxPx: 440 }, collapsible: false },
    secondary: { size: { defaultPx: 188, minPx: 188, maxPx: 188 }, collapsible: false, showHeader: false },
  },
  slots: [
    {
      id: "inspector",
      role: "auxiliary",
      region: "side",
      binding: { kind: { kind: "resource-kind", id: "kiln.object" }, view: views[1].ref, cardinality: "one" },
      openOn: "page-resource",
      floatingPanels: "hidden",
    },
  ],
  initialResource: true,
});
export default defineExtension({
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
