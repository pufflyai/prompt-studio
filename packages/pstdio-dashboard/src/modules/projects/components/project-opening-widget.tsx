import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { isProjectWorkspaceReady } from "@/shared/workspaces/workspace-state";
import { findDashboardProject } from "../data/project-data";
import { ProjectOpening } from "./project-opening";

const OpenSelectedProject = (props: { input: WorkbenchPanelRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const { t } = useTranslation("projects");
  const prepared = useSyncExternalStore(subscribeDashboardData, () => isProjectWorkspaceReady(projectId));
  const sync = useQuery({
    queryKey: ["project-sync-status", projectId],
    queryFn: () => getApiClient().account.projectSyncStatus(projectId),
    refetchInterval: 2000,
    retry: false,
  });
  const downloaded = sync.data?.state === "local" || sync.data?.offlineReady === true;
  const opening = useQuery({
    queryKey: ["open-project", projectId],
    queryFn: () => getApiClient().projects.open(projectId),
    enabled: downloaded && !prepared,
    retry: false,
    staleTime: 0,
  });
  const retry = useMutation({
    mutationFn: () => getApiClient().account.retryProjectSync(projectId),
    onSuccess: () => sync.refetch(),
  });
  const ready = prepared || (downloaded && opening.isSuccess && !opening.isFetching);
  useEffect(() => {
    if (ready) input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
  }, [ready, input.workbench, input.instance.instanceId]);
  const downloadRetryError = downloaded ? undefined : retry.error?.message;
  let error = sync.error?.message ?? (opening.isFetching ? undefined : opening.error?.message) ?? downloadRetryError;
  if (!error && sync.data?.state === "needs-attention") error = t("opening.downloadFailed");
  if (!error && sync.data?.state === "offline" && !downloaded) error = t("opening.offline");
  return (
    <ProjectOpening
      projectName={findDashboardProject(projectId)?.name ?? ""}
      downloading={!downloaded}
      error={error}
      onRetry={() => {
        retry.reset();
        if (downloaded) void opening.refetch();
        else retry.mutate();
      }}
      onBack={() => {
        input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
        void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
      }}
    />
  );
};

export const ProjectOpeningWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const projectId = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  return typeof projectId === "string" ? (
    <OpenSelectedProject key={projectId} input={input} projectId={projectId} />
  ) : null;
};
