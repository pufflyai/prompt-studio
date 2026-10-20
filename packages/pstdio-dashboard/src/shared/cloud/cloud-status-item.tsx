import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { SyncStatus } from "./sync-status";
import { useCloudProject } from "./use-cloud-account";

export const CloudStatusItem = (props: { ctx: WorkbenchModuleContext }) => {
  const { ctx } = props;
  const projectId = useSyncExternalStore(
    (listener) => subscribeDashboardSelectedProject(ctx, listener),
    () => getDashboardSelectedProjectId(ctx),
  );
  const query = useCloudProject(projectId);
  if (!projectId) return null;
  return (
    <SyncStatus
      state={query.isError ? "offline" : (query.data?.state ?? "first-download-incomplete")}
      onRetry={() => {
        void query.refetch();
      }}
      onSettings={() => {
        void ctx.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "cloud-account" });
      }}
    />
  );
};
