import { defineExtension, definePlacement } from "@pstdio/sdk/extensions";
import { defineExample, webview } from "../definition";

const views = [
  webview("boombox-playlist", "Lazy Sunday"),
  webview("boombox-player", "Player"),
  webview("boombox-nav", "Boombox"),
  webview("boombox-rail", "Library"),
];
const example = defineExample({
  name: "boombox",
  label: "Boombox",
  icon: "Radio",
  primary: views[0].ref,
  chrome: { nav: views[2].ref, sidenav: false, activity: views[3].ref },
  regionSettings: {
    secondary: { size: { defaultPx: 88, minPx: 88, maxPx: 88 }, collapsible: false, showHeader: false },
  },
  initialResource: true,
});
export default defineExtension({
  placements: [
    definePlacement({
      id: "boombox-player",
      mode: example.mode.ref,
      region: "secondary",
      item: { kind: "view", view: views[1].ref, presence: "fixed" },
    }),
  ],
  modes: [example.mode],
  themes: [example.theme],
  resourceKinds: [example.resourceKind],
  pages: [example.homePage, example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
