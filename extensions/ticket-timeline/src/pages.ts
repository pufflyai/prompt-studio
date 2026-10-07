// Place the execution plan webview on its own project page with a Tools navigation row.
import { defineNavigationItem, definePage, defineView, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";

export const timelineView = defineView({
  id: "timeline",
  title: "Timeline",
  body: {
    kind: "webview",
    entry: packageAsset("./view/entry.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});

export const timelinePage = definePage({
  id: "timeline",
  title: "Ticket timeline",
  path: "ticket-timeline",
  icon: "list-ordered",
  mode: workbenchModes.project,
  main: { kind: "view", view: timelineView.ref, cardinality: "one" },
  slots: [],
});

export const timelineNavigation = defineNavigationItem({
  id: "timeline",
  owner: workbenchModes.project,
  slot: "content",
  group: "Tools",
  label: "Ticket timeline",
  icon: "list-ordered",
  action: { kind: "page", page: timelinePage.ref },
});
