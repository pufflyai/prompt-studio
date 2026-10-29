import { defineExtension } from "@pstdio/sdk/extensions";
import { marmaladeKeyboardActions } from "../apps/marmalade/marmalade-keybindings";
import { defineExample, webview } from "../definition";

const views = [
  webview("marmalade-canvas", "Great Wave"),
  webview("marmalade-inspector", "Properties and layers"),
  webview("marmalade-rail", "Marmalade tools"),
  webview("marmalade-nav", "Marmalade"),
  webview("marmalade-status", "Document status"),
];
const example = defineExample({
  name: "marmalade",
  label: "Marmalade",
  icon: "Image",
  primary: views[0].ref,
  initialResource: true,
  floatingPanels: "hidden",
  chrome: { nav: views[3].ref, sidenav: false, activity: views[2].ref, status: views[4].ref },
  regionSettings: {
    side: { size: { defaultPx: 320, minPx: 260, maxPx: 480 }, collapsible: false, alwaysShowTabs: false },
  },
  slots: [
    {
      id: "inspector",
      region: "side",
      openOn: "page-resource",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "marmalade.document" }],
          view: views[1].ref,
          cardinality: "one",
        },
      },
    },
  ],
});
export default defineExtension({
  ...marmaladeKeyboardActions(example.mode.ref),
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.homePage, example.page],
  views,
  navigationItems: [example.navigation],
});
