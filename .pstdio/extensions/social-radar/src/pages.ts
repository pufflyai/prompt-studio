import {
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineViewMenu,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { runResource, threadResource } from "./store";
import { digestView } from "./views/digest";
import { radarTree } from "./views/navigation";
import { settingsView } from "./views/settings-view";
import { threadsBoard } from "./views/threads-board";
import { analysisView, threadView } from "./views/webviews";

// The radar page owns the navigation tree, so it and its child pages share one Sidenav level.
const radarPage = definePage({
  id: "radar",
  title: "Social radar",
  icon: "radar",
  path: "social-radar",
  mode: workbenchModes.project,
  main: { kind: "view", view: analysisView.ref, cardinality: "one" },
  slots: [],
});
const threadsPage = definePage({
  id: "threads",
  title: "Threads",
  icon: "list",
  path: "social-radar/threads",
  mode: workbenchModes.project,
  parent: radarPage.ref,
  main: { kind: "view", view: threadsBoard.ref, cardinality: "one" },
  slots: [],
});
const threadPage = definePage({
  id: "thread",
  title: "Thread",
  path: "social-radar/thread",
  mode: workbenchModes.project,
  parent: threadsPage.ref,
  resource: { kinds: [threadResource.ref] },
  main: { kind: "view", view: threadView.ref, cardinality: "one" },
  slots: [],
});
const runPage = definePage({
  id: "run",
  title: "Run",
  path: "social-radar/run",
  mode: workbenchModes.project,
  parent: radarPage.ref,
  resource: { kinds: [runResource.ref] },
  main: { kind: "view", view: digestView.ref, cardinality: "one" },
  slots: [],
});

export const pages = [radarPage, threadsPage, threadPage, runPage];
export const views = [analysisView, threadsBoard, threadView, digestView, settingsView, radarTree];
// Settings sit next to every radar view instead of on a page of their own.
export const viewMenus = [analysisView, threadsBoard, threadView, digestView].map((owner) =>
  defineViewMenu({ id: `settings-${owner.id}`, owner: owner.ref, view: settingsView.ref, side: "right" }),
);
export const navigationItems = [
  defineNavigationItem({
    id: "radar",
    owner: workbenchModes.project,
    slot: "content",
    group: "Tools",
    label: "Social radar",
    icon: "radar",
    action: { kind: "page", page: radarPage.ref },
  }),
];
export const navigationTrees = [
  defineNavigationTree({
    id: "radar",
    owner: radarPage.ref,
    slot: "content",
    view: radarTree.ref,
    resourceScope: "project",
  }),
];
