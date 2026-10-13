import { Box } from "@chakra-ui/react";
import { Header, PANEL_HEADER_CONTROL_SIZE } from "@pstdio/ui";
import { headerTrailingMenuPath, type WorkbenchCore } from "../../core";
import { WorkbenchHeaderActions } from "../header/header-actions";
import { PanelHeaderContextMenu, PanelHeaderEdge } from "../region/panel-header-menu";
import { WorkbenchRegion } from "../region/region";
import {
  useWorkbenchPanelHeaderVisible,
  useWorkbenchRegionTabsVisible,
  WorkbenchRegionTabs,
} from "../region/region-tabs";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";
import { WorkbenchHeaderBorder } from "./header-bottom-border";

const mainHeaderTrailingMenuPath = headerTrailingMenuPath("main");

interface MainHeaderBarProps {
  workbench: WorkbenchCore;
  hasMainHeader: boolean;
}

export const MainHeaderBar = (props: MainHeaderBarProps) => {
  const { workbench, hasMainHeader } = props;
  const hasMainContentTabs = useWorkbenchRegionTabsVisible(workbench, "main");
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "main");
  const policy = usePanelPolicy(workbench, "main");

  const visible = policy.legacyHeaders
    ? (policy.showHeader || hasMainContentTabs) && (hasMainHeader || hasPanelHeader)
    : policy.showHeader;

  return (
    <>
      <PanelHeaderEdge workbench={workbench} region="main" visible={visible} />
      <PanelHeaderContextMenu workbench={workbench} region="main">
        <Header
          tabIndex={0}
          data-workbench-panel-header="main"
          display={visible ? "flex" : "none"}
          variant="main"
          bg={workbenchBackgrounds.main}
          position="relative"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <WorkbenchRegionTabs workbench={workbench} region="main" />
          {/* The tab strip grows into the empty header, so only claim space when a
          main-header view is actually mounted or when there are no tabs to claim it. */}
          <Box flex={hasMainHeader || !hasMainContentTabs ? "1" : "0"} h="full" minW="0" overflow="hidden">
            <WorkbenchRegion workbench={workbench} region="main-header" title="Main header" />
          </Box>
          <WorkbenchHeaderActions
            workbench={workbench}
            menuPath={mainHeaderTrailingMenuPath}
            controlSize={PANEL_HEADER_CONTROL_SIZE}
          />
          <WorkbenchHeaderBorder workbench={workbench} region="main-header" />
        </Header>
      </PanelHeaderContextMenu>
    </>
  );
};
