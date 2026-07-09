import { Avatar, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { ChevronsUpDown } from "lucide-react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  dashboardSelectedProjectIdContextKey,
  dashboardSelectedProjectNameContextKey,
} from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { DashboardSidebarHeaderActions } from "@/shared/workbench/dashboard-sidebar-header-actions";
import { findDashboardProject } from "../data/project-data";

const projectButtonInteraction = {
  _hover: { bg: "bg.menu-item.hover" },
  _active: { bg: "bg.menu-item.selected" },
};

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
    <Stack gap="0" w="full" minW="0">
      <HStack gap="2xs" minH="2.5rem" w="full" minW="0" px="2xs" paddingRight="xs" alignItems="center">
        <Tooltip content="Go to project home">
          <Button
            px="xs"
            variant="ghost"
            size="xs"
            flex="1"
            minW="0"
            justifyContent="flex-start"
            onClick={() => {
              void input.workbench.resources.openResource(dashboardResources.start, { replaceActive: true });
            }}
            {...projectButtonInteraction}
          >
            <HStack gap="xs" minW="0" flex="1">
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
      <DashboardSidebarHeaderActions input={input} />
    </Stack>
  );
};
