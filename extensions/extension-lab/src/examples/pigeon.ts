import { defineExtension } from "@pstdio/sdk/extensions";
import { defineExample, webview } from "../definition";

const views = [
  webview("pigeon-inbox", "Inbox"),
  webview("pigeon-reader", "Message", ["placement.close"]),
  webview("pigeon-folders", "Folders"),
  webview("pigeon-nav", "Pigeon"),
];
export const example = defineExample({
  name: "pigeon",
  label: "Pigeon",
  icon: "Mail",
  primary: views[0].ref,
  chrome: { nav: views[3].ref, sidenav: views[2].ref, activity: false },
  regionSettings: {
    sidenav: { size: { defaultPx: 220, minPx: 200, maxPx: 280 }, collapsible: false },
    side: { size: { defaultPx: 480, minPx: 360, maxPx: 600 } },
  },
  slots: [
    {
      id: "reader",
      region: "side",
      openOn: "page-resource",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "pigeon.thread" }],
          view: views[1].ref,
          cardinality: "one",
        },
      },
    },
  ],
  initialResource: false,
});
export default defineExtension({
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.homePage, example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
