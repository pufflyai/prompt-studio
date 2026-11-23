import { defineCommand, defineView, l10n, packageAsset, params } from "@pstdio/sdk/extensions";
import { deployedName, getDeployed } from "./deployed-controller";
import type { WorkspaceActivity } from "./workspace-history";
import { defaultHistoryRange, historyRanges, workspaceHistoryCommandId } from "./workspace-history-range";

const read = defineCommand({
  id: workspaceHistoryCommandId,
  title: l10n("cloud-workspaces.read-running-workspace-history", "Read running workspace history"),
  cli: true,
  params: {
    range: params.select({
      label: l10n("cloud-workspaces.time-range", "Time range"),
      options: historyRanges,
    }),
  },
  async run(ctx, input) {
    const range = input.range ?? defaultHistoryRange;
    const [settings, activity] = await Promise.all([
      ctx.settings.all(),
      getDeployed<WorkspaceActivity>(
        ctx.connections,
        `/v1/workspaces/activity?range=${encodeURIComponent(range)}`,
        ctx.signal,
      ),
    ]);
    return { name: deployedName(settings), ...activity };
  },
});

export const workspaceHistoryCommands = { [workspaceHistoryCommandId]: read };

export const workspaceHistoryView = defineView({
  id: "workspace-history",
  title: l10n("cloud-workspaces.workspace-activity", "Workspace activity"),
  icon: "chart-line",
  body: {
    kind: "webview",
    entry: packageAsset("./workspace-history-webview.ts", import.meta.url),
    capabilities: ["commands.query"],
  },
});
