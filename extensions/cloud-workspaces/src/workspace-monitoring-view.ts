import { defineView, l10n, packageAsset } from "@pstdio/sdk/extensions";

const title = l10n("cloud-workspaces.monitoring", "Monitoring");

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
