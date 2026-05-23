import { Button, Text } from "@chakra-ui/react";
import { SidebarProjectMenu } from "@pstdio/ui";
import { ArrowLeft } from "lucide-react";
import type { WorkbenchCore } from "pstdio-workbench/core";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { getDashboardDataVersion, subscribeDashboardData } from "../../../data/dashboard-data";
import { findDashboardProject } from "../../../data/project-data";
import {
  dashboardSelectedProjectIdContextKey,
  dashboardSelectedProjectNameContextKey,
} from "../../../shared/project-context";
import { dashboardResources } from "../../../shared/resources";

const resolveProjectName = (projectId: unknown, projectName: unknown, _dataVersion: number) => {
  const project = typeof projectId === "string" ? findDashboardProject(projectId) : undefined;
  return project?.name ?? (typeof projectName === "string" ? projectName : "Projects");
};

export const DashboardLeftHeader = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const activeModeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const selectedProjectId = useWorkbenchStore(
    workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  const selectedProjectName = useWorkbenchStore(
    workbench.context.store,
    (state) => state.values[dashboardSelectedProjectNameContextKey],
  );
  const dashboardDataVersion = useSyncExternalStore(
    subscribeDashboardData,
    getDashboardDataVersion,
    getDashboardDataVersion,
  );

  if (activeModeId === "settings" || activeModeId === "sessions") {
    return (
      <Button
        variant="ghost"
        size="sm"
        width="full"
        justifyContent="flex-start"
        px="xs"
        onClick={() => {
          void workbench.resources.openResource(dashboardResources.workspaces, { replaceActive: true });
        }}
      >
        <ArrowLeft size={14} />
        <Text textStyle="label/M/medium" truncate>
          Back to project
        </Text>
      </Button>
    );
  }

  const projectName = resolveProjectName(selectedProjectId, selectedProjectName, dashboardDataVersion);

  return (
    <SidebarProjectMenu
      name={projectName}
      projectsLabel="Projects"
      onSelectProjects={() => {
        void workbench.commands.executeCommand("dashboard.openProjects");
      }}
    />
  );
};
