import { defineExtension, definePlacement } from "@pstdio/sdk/extensions";
import { definePageExample, webview } from "../definition";

const views = [
  webview("boombox-playlist", "Lazy Sunday"),
  webview("boombox-player", "Player"),
  webview("boombox-nav", "Boombox"),
  webview("boombox-rail", "Library"),
  webview("boombox-queue", "Queue"),
];
const example = definePageExample({
  name: "boombox",
  label: "Boombox",
  icon: "Radio",
  primary: views[0].ref,
  canFullscreen: false,
  params: { selection: { type: "string" } },
  chrome: { nav: views[2].ref, sidenav: false, activity: views[3].ref },
  regionSettings: {
    side: { size: { defaultPx: 300, minPx: 240, maxPx: 440 }, canClose: false, floatable: false, showHeader: false },
    secondary: { size: { defaultPx: 88, minPx: 88, maxPx: 88 }, canClose: false, resizable: false, showHeader: false },
  },
});
export default defineExtension({
  placements: [
    definePlacement({
      id: "boombox-queue",
      mode: example.mode.ref,
      region: "side",
      item: { kind: "view", view: views[4].ref, presence: "fixed" },
    }),
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
  pages: [example.page],
  views: [...views],
  navigationItems: [example.navigation],
});
