import {
  defineNavigationItem,
  definePage,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

export const timelineView = defineView({
  id: "timeline",
  title: l10n("timeline.view.title", "Timeline"),
  icon: "chart-no-axes-gantt",
  body: {
    kind: "webview",
    entry: packageAsset("./view/entry.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open", "files.upload"],
  },
});

export const timelinePage = definePage({
  id: "timeline",
  title: l10n("timeline.page.title", "Ticket timeline"),
  path: "ticket-timeline",
  icon: "chart-no-axes-gantt",
  mode: workbenchModes.project,
  main: { kind: "view", view: timelineView.ref, cardinality: "one" },
  slots: [],
});

export const timelineNavigation = defineNavigationItem({
  id: "timeline",
  owner: workbenchModes.project,
  slot: "content",
  group: "Project Planning",
  label: l10n("timeline.page.title", "Ticket timeline"),
  icon: "chart-no-axes-gantt",
  action: { kind: "page", page: timelinePage.ref },
});
