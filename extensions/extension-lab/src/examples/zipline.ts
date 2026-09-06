import { defineExtension } from "@pstdio/sdk/extensions";
import { defineExample, webview } from "../definition";
import { board } from "./zipline-board";

const views = [
  webview("zipline-inspector", "Issue"),
  webview("zipline-workspace", "Workspace"),
  webview("zipline-rail", "Zipline"),
];
views.push(webview("zipline-status", "Issue count"));
const example = defineExample({
  name: "zipline",
  label: "Zipline",
  icon: "Columns3",
  primary: board.ref,
  chrome: { status: views.at(-1)!.ref, sidenav: views[1].ref, activity: views[2].ref },
  regionSettings: {
    sidenav: { size: { defaultPx: 225, minPx: 200, maxPx: 300 }, collapsible: false },
    side: { size: { defaultPx: 360, minPx: 310, maxPx: 440 } },
  },
  slots: [
    {
      id: "inspector",
      region: "side",
      openOn: "page-resource",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "zipline.issue" }],
          view: views[0].ref,
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
  views: [board, ...views],
  navigationItems: [example.navigation],
});
