import {
  defineNavigationItem,
  definePage,
  defineView,
  l10n,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { attentionPanel } from "../attention-panel";
import { ticketPreviewPanel } from "./ticket-preview";

export const timelineActionsView = defineView({
  id: "timeline-actions",
  title: l10n("timeline.actions.title", "Timeline actions"),
  body: {
    kind: "webview",
    entry: packageAsset("./view/header-entry.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query", "navigation.open"],
  },
});

export const autoBuildView = defineView({
  id: "auto-build",
  title: l10n("timeline.autoBuild.start", "Auto Build"),
  body: {
    kind: "webview",
    entry: packageAsset("./view/auto-build-entry.tsx", import.meta.url),
    capabilities: ["commands.execute", "commands.query", "navigation.open", "harnesses.read", "placement.close"],
  },
});

export const autoBuildPage = definePage({
  id: "auto-build",
  title: l10n("timeline.autoBuild.start", "Auto Build"),
  path: "auto-build",
  mode: workbenchModes.project,
  main: { kind: "view", presentation: "page", view: autoBuildView.ref, cardinality: "one" },
  slots: [],
});

export const timelineView = defineView({
  id: "timeline",
  title: l10n("timeline.view.title", "Project Timeline"),
  icon: "chart-no-axes-gantt",
  header: { view: timelineActionsView.ref },
  body: {
    kind: "webview",
    entry: packageAsset("./view/entry.tsx", import.meta.url),
    capabilities: [
      "commands.execute",
      "commands.query",
      "navigation.open",
      "harnesses.read",
      "resources.actions",
      "files.upload",
      "preferences.get",
      "preferences.set",
    ],
  },
});

export const timelinePage = definePage({
  id: "timeline",
  title: l10n("timeline.page.title", "Project Timeline"),
  path: "ticket-timeline",
  icon: "chart-no-axes-gantt",
  mode: workbenchModes.project,
  main: { kind: "view", presentation: "page", view: timelineView.ref, cardinality: "one" },
  slots: [ticketPreviewPanel, attentionPanel],
});

export const timelineNavigation = defineNavigationItem({
  id: "timeline",
  owner: workbenchModes.project,
  slot: "content",
  group: "Project Planning",
  label: l10n("timeline.page.title", "Project Timeline"),
  icon: "chart-no-axes-gantt",
  action: { kind: "page", page: timelinePage.ref },
});
