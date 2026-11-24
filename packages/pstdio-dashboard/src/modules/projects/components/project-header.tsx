import { HStack, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { ChevronsUpDown } from "lucide-react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { ProjectCrumb, projectButtonInteraction } from "./project-crumb";

export const ProjectHeader = ({ workbench }: { workbench: WorkbenchCore }) => {
  return (
    <HStack gap="xs" h="full" minW="0" w="full">
      <HStack gap="2xs" flexShrink={0} minW="0">
        <ProjectCrumb workbench={workbench} />
        <Tooltip content="Switch project">
          <IconButton
            variant="ghost"
            size="xs"
            flexShrink={0}
            aria-label="Switch project"
            onClick={() => {
              void workbench.commands.executeCommand(dashboardCommandIds.openProjects);
            }}
            {...projectButtonInteraction}
          >
            <ChevronsUpDown size={14} />
          </IconButton>
        </Tooltip>
      </HStack>
    </HStack>
  );
};
