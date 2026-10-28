import { defineExtension } from "@pstdio/sdk/extensions";
import { definePageExample, webview } from "../definition";
import { pigeonReader } from "../pigeon-refs";

const views = [
  webview("pigeon-inbox", "Inbox"),
  webview("pigeon-reader", "Message", ["placement.close"]),
  webview("pigeon-folders", "Folders"),
  webview("pigeon-nav", "Pigeon"),
];
export const example = definePageExample({
  name: "pigeon",
  label: "Pigeon",
  icon: "Mail",
  primary: views[0].ref,
  params: { selection: { type: "string" } },
  regions: ["main", "side"],
  chrome: { nav: views[3].ref, sidenav: views[2].ref, activity: false },
  regionSettings: {
    sidenav: { size: { defaultPx: 220, minPx: 200, maxPx: 280 }, canClose: false },
    side: { size: { defaultPx: 480, minPx: 360, maxPx: 600 } },
  },
  slots: [
    {
      id: pigeonReader.id,
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
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
