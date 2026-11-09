import { defineNavigationItem, definePage, defineView, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";

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
const performancePage = definePage({
  id: "performance",
  title: "Performance",
  icon: "gauge",
  path: "performance",
  mode: workbenchModes.project,
  main: { kind: "panels", landing: "trends" },
  slots: [trends, compare, runs].map((view, order) => ({
    id: view.id,
    region: "main" as const,
    order,
    mountStrategy: "keep-mounted" as const,
    tab: { query: () => ({ label: view.title, icon: view.icon }) },
    item: { kind: "view" as const, view: view.ref, presence: "open" as const },
  })),
});
export const pages = [performancePage];
export const views = [trends, compare, runs];
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
