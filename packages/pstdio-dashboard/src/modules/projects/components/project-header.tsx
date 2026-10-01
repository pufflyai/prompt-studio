import { HStack, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useWorkbenchStore, WorkbenchBreadcrumbView, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { ChevronsUpDown } from "lucide-react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { ProjectCrumb, projectButtonInteraction } from "./project-crumb";

export const ProjectHeader = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const breadcrumbItems = useWorkbenchStore(input.workbench.breadcrumbs.store, (state) => state.items) ?? [];

  return (
    <HStack gap="xs" h="full" minW="0" w="full">
      <HStack gap="2xs" flexShrink={0} minW="0">
        <ProjectCrumb workbench={input.workbench} />
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
