import { Avatar, Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useWorkbenchStore, WorkbenchBreadcrumbView, type WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { ChevronsUpDown } from "lucide-react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  dashboardSelectedProjectIdContextKey,
  dashboardSelectedProjectNameContextKey,
} from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { findDashboardProject } from "../data/project-data";

const projectButtonInteraction = {
  _hover: { bg: "bg.menu-item.hover" },
  _active: { bg: "bg.menu-item.selected" },
};

const resolveProjectName = (projectId: unknown, projectName: unknown, _dataVersion: number) => {
  const project = typeof projectId === "string" ? findDashboardProject(projectId) : undefined;
  return project?.name ?? (typeof projectName === "string" ? projectName : "Projects");
};

export const ProjectHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
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
  const breadcrumbItems = useWorkbenchStore(input.workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const projectName = resolveProjectName(selectedProjectId, selectedProjectName, dashboardDataVersion);

  return (
    <HStack gap="xs" h="full" minW="0" w="full">
      <HStack gap="2xs" flexShrink={0} minW="0">
        <Tooltip content="Go to project home">
          <Button
            px="xs"
            variant="ghost"
            size="xs"
            maxW="2xs"
            minW="0"
            justifyContent="flex-start"
            onClick={() => {
              void input.workbench.resources.openResource(dashboardResources.start, { replaceActive: true });
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
        <Tooltip content="Switch project">
          <IconButton
            variant="ghost"
            size="xs"
            flexShrink={0}
            aria-label="Switch project"
            onClick={() => {
              void input.workbench.commands.executeCommand(dashboardCommandIds.openProjects);
            }}
            {...projectButtonInteraction}
          >
            <ChevronsUpDown size={14} />
          </IconButton>
        </Tooltip>
      </HStack>
      {breadcrumbItems.length > 0 ? (
        <Text aria-hidden="true" color="fg.subtle" flexShrink={0}>
          /
        </Text>
      ) : null}
      <WorkbenchBreadcrumbView workbench={input.workbench} />
    </HStack>
  );
};
