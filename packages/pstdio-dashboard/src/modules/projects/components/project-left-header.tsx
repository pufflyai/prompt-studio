import { SidebarProjectMenu } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  dashboardSelectedProjectIdContextKey,
  dashboardSelectedProjectNameContextKey,
} from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { findDashboardProject } from "../data/project-data";

const resolveProjectName = (projectId: unknown, projectName: unknown, _dataVersion: number) => {
  const project = typeof projectId === "string" ? findDashboardProject(projectId) : undefined;
  return project?.name ?? (typeof projectName === "string" ? projectName : "Projects");
};

export const ProjectLeftHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const selectedProjectId = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  const selectedProjectName = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectNameContextKey],
  );
  const dashboardDataVersion = useSyncExternalStore(
    subscribeDashboardData,
    getDashboardDataVersion,
    getDashboardDataVersion,
  );
  const projectName = resolveProjectName(selectedProjectId, selectedProjectName, dashboardDataVersion);

  return (
    <SidebarProjectMenu
      name={projectName}
      projectsLabel="Projects"
      onSelectProjects={() => {
        void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
      }}
    />
  );
};
