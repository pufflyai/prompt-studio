import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchArea } from "../area/area";
import { WorkbenchAreaTabs } from "../area/area-tabs";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

interface WorkbenchMainBottomSectionProps {
  workbench: WorkbenchCore;
  hasMainBottomHeader: boolean;
  hasMainBottomContentTabs: boolean;
}

export const WorkbenchMainBottomSection = (props: WorkbenchMainBottomSectionProps) => {
  const { workbench, hasMainBottomHeader, hasMainBottomContentTabs } = props;

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      area="panel"
      as="section"
      bg={workbenchBackgrounds.panel}
      h="full"
      minH="0"
      minW="0"
      w="full"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {hasMainBottomHeader || hasMainBottomContentTabs ? (
        <Header
          variant="main"
          bg={workbenchBackgrounds.panel}
          position="relative"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchAreaTabs workbench={workbench} area="secondary" />
          {hasMainBottomHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <WorkbenchArea
                workbench={workbench}
                area="secondary-header"
                title="Main bottom header"
                showHeader={false}
              />
            </Box>
          ) : null}
          <WorkbenchHeaderBorder workbench={workbench} area="secondary-header" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchArea workbench={workbench} area="secondary" title="Main bottom" />
      </Box>
    </WorkbenchFocusRegion>
  );
};
