import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { WorkbenchRegion } from "../region/region";
import { useWorkbenchPanelHeaderVisible, WorkbenchRegionTabs } from "../region/region-tabs";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

interface WorkbenchSecondaryPanelProps {
  workbench: WorkbenchCore;
  hasSecondaryHeader: boolean;
}

export const WorkbenchSecondaryPanel = (props: WorkbenchSecondaryPanelProps) => {
  const { workbench, hasSecondaryHeader } = props;
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "secondary");

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="secondary"
      data-workbench-panel="secondary"
      data-workbench-region="secondary"
      as="section"
      bg={workbenchBackgrounds.panel}
      flex="1"
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      w="full"
    >
      {hasSecondaryHeader || hasPanelHeader ? (
        <Header
          data-workbench-panel-header="secondary"
          variant="main"
          bg={workbenchBackgrounds.panel}
          position="relative"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchRegionTabs workbench={workbench} region="secondary" />
          {hasSecondaryHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <WorkbenchRegion workbench={workbench} region="secondary-header" title="Secondary Panel header" />
            </Box>
          ) : null}
          <WorkbenchPanelMenuOpeners workbench={workbench} panel="secondary" />
          <WorkbenchHeaderBorder workbench={workbench} region="secondary-header" />
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchPanelMenuLayout workbench={workbench} panel="secondary">
          <WorkbenchRegion workbench={workbench} region="secondary" title="Secondary Panel" />
        </WorkbenchPanelMenuLayout>
      </Box>
    </WorkbenchFocusRegion>
  );
};
