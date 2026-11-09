import { defineNavigationItem, definePage, defineView, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";

const performanceView = defineView({
  id: "performance",
  title: "Performance",
  icon: "gauge",
  body: {
    kind: "webview",
    entry: packageAsset("./performance/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
const performancePage = definePage({
  id: "performance",
  title: "Performance",
  icon: "gauge",
  path: "performance",
  mode: workbenchModes.project,
  main: { kind: "view", view: performanceView.ref, cardinality: "one" },
  slots: [],
});
export const pages = [performancePage];
export const views = [performanceView];
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
