import { definePage, defineView, l10n, packageAsset, workbenchModes } from "@pstdio/sdk/extensions";
import { deployedPageRef } from "./lab-navigation";
import { deployedMachineKind } from "./resources";
import { monitoringRangeParam } from "./workspace-monitoring-range";

const title = l10n("cloud-workspaces.workspace-monitoring", "Workspace Monitoring");

export const workspaceMonitoringView = defineView({
  // Keep the existing slot and view IDs so saved layouts retain their placement.
  id: "workspace-history",
  title,
  icon: "chart-line",
  body: {
    kind: "webview",
    entry: packageAsset("./workspace-monitoring-webview.tsx", import.meta.url),
    capabilities: ["commands.query", "navigation.open", "page.params.update"],
  },
});

export const workspaceMonitoringDetailView = defineView({
  id: "workspace-monitoring-detail",
  title: l10n("cloud-workspaces.monitoring-detail", "Workspace details"),
  icon: "bot",
  body: {
    kind: "webview",
    entry: packageAsset("./workspace-monitoring-webview.tsx", import.meta.url),
    capabilities: ["commands.query", "navigation.open", "page.params.update"],
  },
});

export const workspaceMonitoringDetailPage = definePage({
  id: "workspace-monitoring-detail",
  title: l10n("cloud-workspaces.monitoring-detail", "Workspace details"),
  icon: "bot",
  path: "pocketcoder-workspace-monitoring",
  mode: workbenchModes.project,
  parent: deployedPageRef,
  params: { "monitoring-range": monitoringRangeParam },
  resource: { kinds: [deployedMachineKind.ref] },
  main: { kind: "panels", landing: "monitoring" },
  slots: [
    {
      id: "monitoring",
      region: "main",
      item: { kind: "view", view: workspaceMonitoringDetailView.ref, presence: "fixed" },
    },
  ],
});
