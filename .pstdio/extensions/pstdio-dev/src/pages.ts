import {
  defineNavigationTree,
  definePage,
  defineView,
  defineViewMenu,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const trends = defineView({
  id: "trends",
  title: "Trends",
  icon: "chart-line",
  body: {
    kind: "webview",
    entry: packageAsset("./trends/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
const compare = defineView({
  id: "compare",
  title: "Compare",
  icon: "git-compare",
  body: {
    kind: "webview",
    entry: packageAsset("./compare/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
const runs = defineView({
  id: "runs",
  title: "Runs",
  icon: "play",
  body: {
    kind: "webview",
    entry: packageAsset("./runs/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
const runOptions = defineView({
  id: "run-options",
  title: l10n("views.newRun", "New run"),
  icon: "play",
  body: {
    kind: "webview",
    entry: packageAsset("./runs/options-main.tsx", import.meta.url),
    capabilities: ["commands.execute"],
  },
});
const health = defineView({
  id: "release-health",
  title: "Release health",
  icon: "chart-line",
  body: {
    kind: "webview",
    entry: packageAsset("./releases/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
const performancePage = definePage({
  id: "performance",
  title: "Performance",
  icon: "gauge",
  path: "performance",
  mode: workbenchModes.project,
  main: { kind: "view", view: trends.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const comparePage = definePage({
  id: "compare",
  title: "Compare",
  icon: compare.icon,
  path: "compare",
  mode: workbenchModes.project,
  parent: performancePage.ref,
  main: { kind: "view", view: compare.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const runsPage = definePage({
  id: "runs",
  title: "Runs",
  icon: runs.icon,
  path: "runs",
  mode: workbenchModes.project,
  parent: performancePage.ref,
  main: { kind: "view", view: runs.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
const performanceTree = defineView({
  id: "performance-navigation",
  title: l10n("navigation.performance", "Performance"),
  body: {
    kind: "tree",
    body: async () => [
      {
        id: "performance",
        collapsible: false,
        nodes: [
          {
            id: "performance",
            label: l10n("navigation.performance", "Performance"),
            icon: "gauge",
            collapsible: true,
            children: [
              {
                id: "trends",
                label: trends.title,
                icon: trends.icon,
                target: { kind: "page", page: performancePage.ref },
              },
              {
                id: "compare",
                label: compare.title,
                icon: compare.icon,
                target: { kind: "page", page: comparePage.ref },
              },
              { id: "runs", label: runs.title, icon: runs.icon, target: { kind: "page", page: runsPage.ref } },
              {
                id: "release-health",
                label: health.title,
                icon: health.icon,
                target: { kind: "page", page: healthPage.ref },
              },
            ],
          },
        ],
      },
    ],
  },
});
const healthPage = definePage({
  id: "release-health",
  title: health.title,
  icon: health.icon,
  path: "release-health",
  mode: workbenchModes.project,
  parent: performancePage.ref,
  main: { kind: "view", view: health.ref, cardinality: "one", presentation: "page" },
  slots: [],
});
export const pages = [performancePage, comparePage, runsPage, healthPage];
export const views = [trends, compare, runs, runOptions, performanceTree, health];
export const navigationTrees = [
  defineNavigationTree({
    id: "performance",
    owner: workbenchModes.project,
    slot: "content",
    view: performanceTree.ref,
    resourceScope: "project",
  }),
];
export const viewMenus = [defineViewMenu({ id: "run-options", owner: runs.ref, view: runOptions.ref, side: "right" })];
