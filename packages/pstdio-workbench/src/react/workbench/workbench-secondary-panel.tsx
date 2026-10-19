import { Box } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { PanelHeader } from "../region/panel-header";
import { WorkbenchRegion } from "../region/region";
import {
  useWorkbenchPanelHeaderVisible,
  useWorkbenchRegionTabsVisible,
  WorkbenchRegionTabs,
} from "../region/region-tabs";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

interface WorkbenchSecondaryPanelProps {
  workbench: WorkbenchCore;
  hasSecondaryHeader: boolean;
}

export const WorkbenchSecondaryPanel = (props: WorkbenchSecondaryPanelProps) => {
  const { workbench, hasSecondaryHeader } = props;
  const hasTabs = useWorkbenchRegionTabsVisible(workbench, "secondary");
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "secondary");

  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="secondary"
      data-workbench-panel="secondary"
      data-workbench-region="secondary"
      as="section"
      bg={workbenchBackgrounds.panel}
      layerStyle="panel"
      flex="1"
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      w="full"
      position="relative"
    >
      <PanelHeader
        workbench={workbench}
        region="secondary"
        hasTabs={hasTabs}
        hasContent={hasSecondaryHeader || hasPanelHeader}
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
        <Box display={hasSecondaryHeader ? "block" : "none"} flex="1" h="full" minW="0" overflow="hidden">
          <WorkbenchRegion workbench={workbench} region="secondary-header" title="Secondary Panel header" />
        </Box>
        <WorkbenchPanelMenuOpeners workbench={workbench} panel="secondary" />
        <WorkbenchHeaderBorder workbench={workbench} region="secondary-header" />
      </PanelHeader>
      <WorkbenchTabDropTarget region="secondary" />
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchPanelMenuLayout workbench={workbench} panel="secondary">
          <WorkbenchRegion workbench={workbench} region="secondary" title="Secondary Panel" />
        </WorkbenchPanelMenuLayout>
      </Box>
    </WorkbenchFocusRegion>
  );
};
