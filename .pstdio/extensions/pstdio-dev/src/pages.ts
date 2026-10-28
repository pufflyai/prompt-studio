import {
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { benchmarksChanged } from "./benchmarks/events";

const webview = (id: string, title: string, icon: string, entry: string) =>
  defineView({
    id,
    title,
    icon,
    body: {
      kind: "webview",
      entry: packageAsset(entry, import.meta.url),
      capabilities: ["commands.execute", "navigation.open"],
    },
  });

const trendsView = webview("performance-trends", "Trends", "chart-line", "./trends/main.tsx");
const compareView = webview("performance-compare", "Compare", "git-compare", "./compare/main.tsx");
const runsView = webview("performance-runs", "Runs", "play", "./runs/main.tsx");

// Performance owns the navigation tree, so it and its subpages share one Sidenav level.
const performancePage = definePage({
  id: "performance",
  title: "Performance",
  icon: "gauge",
  path: "performance",
  mode: workbenchModes.project,
  main: { kind: "view", view: trendsView.ref, cardinality: "one" },
  slots: [],
});
const comparePage = definePage({
  id: "performance-compare",
  title: "Compare",
  path: "performance/compare",
  mode: workbenchModes.project,
  parent: performancePage.ref,
  main: { kind: "view", view: compareView.ref, cardinality: "one" },
  slots: [],
});
const runsPage = definePage({
  id: "performance-runs",
  title: "Runs",
  path: "performance/runs",
  mode: workbenchModes.project,
  parent: performancePage.ref,
  main: { kind: "view", view: runsView.ref, cardinality: "one" },
  slots: [],
});

const performanceTree = defineView({
  id: "performance-navigation",
  title: "Performance",
  body: {
    kind: "tree",
    refreshEvents: [benchmarksChanged],
    body: () => [
      {
        id: "pages",
        collapsible: false,
        nodes: [
          { id: "trends", label: "Trends", icon: "ChartLine", target: { kind: "page", page: performancePage.ref } },
          { id: "compare", label: "Compare", icon: "GitCompare", target: { kind: "page", page: comparePage.ref } },
          { id: "runs", label: "Runs", icon: "Play", target: { kind: "page", page: runsPage.ref } },
        ],
      },
    ],
  },
});

export const pages = [performancePage, comparePage, runsPage];
export const views = [trendsView, compareView, runsView, performanceTree];
export const navigationItems = [
  defineNavigationItem({
    id: "performance",
    owner: workbenchModes.project,
    slot: "content",
    group: "Tools",
    label: "Performance",
    icon: "gauge",
    action: { kind: "page", page: performancePage.ref },
  }),
];
export const navigationTrees = [
  defineNavigationTree({
    id: "performance",
    owner: performancePage.ref,
    slot: "content",
    view: performanceTree.ref,
    resourceScope: "project",
  }),
];
