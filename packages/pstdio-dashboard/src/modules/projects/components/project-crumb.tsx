import { Avatar, Button, HStack, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { useSyncExternalStore } from "react";
import {
  dashboardSelectedProjectIdContextKey,
  dashboardSelectedProjectNameContextKey,
} from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { findDashboardProject } from "../data/project-data";

export const projectButtonInteraction = {
  _hover: { bg: "bg.menu-item.hover" },
  _active: { bg: "bg.menu-item.selected" },
};

const resolveProjectName = (projectId: unknown, projectName: unknown, _dataVersion: number) => {
  const project = typeof projectId === "string" ? findDashboardProject(projectId) : undefined;
  return project?.name ?? (typeof projectName === "string" ? projectName : "Projects");
};

export const useDashboardProjectName = (workbench: WorkbenchCore) => {
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
  return resolveProjectName(selectedProjectId, selectedProjectName, dashboardDataVersion);
};

interface ProjectCrumbProps {
  workbench: WorkbenchCore;
}

// The project avatar and title, leading the breadcrumb. It takes the user back to the last page
// outside every Sidenav level, so a level page such as Sessions always has a way out.
export const ProjectCrumb = (props: ProjectCrumbProps) => {
  const { workbench } = props;
  const projectName = useDashboardProjectName(workbench);

  return (
    <Tooltip content="Go to project navigation">
      <Button
        px="xs"
        variant="ghost"
        size="xs"
        maxW="2xs"
        minW="0"
        justifyContent="flex-start"
        onClick={() => {
          workbench.pageLocations.navigateToRootLevel();
        }}
        {...projectButtonInteraction}
      >
        <HStack gap="xs" minW="0">
          <Avatar.Root size="2xs">
            <Avatar.Fallback name={projectName} background="bg.muted" color="fg.muted" />
          </Avatar.Root>
          <Text textStyle="label/S/medium" truncate>
            {projectName}
          </Text>
        </HStack>
      </Button>
    </Tooltip>
  );
};
