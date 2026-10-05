import {
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineViewMenu,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { channelResource, runResource, settingsSection, threadResource } from "./store";
import { digestView } from "./views/digest";
import { radarTree } from "./views/navigation";
import { settingsMenu } from "./views/settings-menu";
import { settingsView } from "./views/settings-view";
import { threadsBoard } from "./views/threads-board";
import { analysisView, threadSummaryView, threadView } from "./views/webviews";

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

const settingsPage = definePage({
  id: "settings",
  title: "Settings",
  icon: "settings",
  path: "social-radar/settings",
  mode: workbenchModes.project,
  parent: radarPage.ref,
  resource: { kinds: [settingsSection.ref, channelResource.ref] },
  main: { kind: "view", view: settingsView.ref, cardinality: "one" },
  slots: [],
});

export const pages = [radarPage, threadsPage, threadPage, runPage, settingsPage];
export const views = [
  analysisView,
  threadsBoard,
  threadView,
  threadSummaryView,
  digestView,
  settingsView,
  settingsMenu,
  radarTree,
];
// Attached menus give the summary and the section list the host's resizable, closable layout.
export const viewMenus = [
  defineViewMenu({ id: "thread-summary", owner: threadView.ref, view: threadSummaryView.ref, side: "right" }),
  defineViewMenu({ id: "settings-sections", owner: settingsView.ref, view: settingsMenu.ref, side: "left" }),
];
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
