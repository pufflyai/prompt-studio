import { Box } from "@chakra-ui/react";
import { Header, ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { PanelHeaderEdge, PanelHeaderMenu } from "../region/panel-header-menu";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

const PAGE_BOTTOM_SIZE = { defaultPx: 160, minPx: 80 };

const PageBottomPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const policy = usePanelPolicy(workbench, "bottom");
  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region="bottom"
      data-workbench-panel="bottom"
      data-workbench-region="bottom"
      bg={workbenchBackgrounds.panel}
      display="flex"
      flexDirection="column"
      h="full"
      minH="0"
      minW="0"
      position="relative"
      overflow="hidden"
    >
      <PanelHeaderEdge workbench={workbench} region="bottom" visible={policy.showHeader} />
      <Header
        variant="main"
        data-workbench-panel-header="bottom"
        flexShrink={0}
        gap="xs"
        display={policy.showHeader ? "flex" : "none"}
      >
        <WorkbenchRegionTabs workbench={workbench} region="bottom" />
        <WorkbenchPanelMenuOpeners workbench={workbench} panel="bottom" />
        <PanelHeaderMenu workbench={workbench} region="bottom" />
      </Header>
      <WorkbenchTabDropTarget region="bottom" />
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchPanelMenuLayout workbench={workbench} panel="bottom">
          <WorkbenchRegion workbench={workbench} region="bottom" title="Page bottom" />
        </WorkbenchPanelMenuLayout>
      </Box>
    </WorkbenchFocusRegion>
  );
};

export const WorkbenchPageBottomLayout = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const settings = page?.regionSettings?.bottom;
  const policy = usePanelPolicy(workbench, "bottom");
  const size = workbench.layout.getRegionSize("bottom");
  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="bottom"
      contentPanel={children}
      resizablePanel={<PageBottomPanel workbench={workbench} />}
      collapsed={!policy.open}
      collapsible={policy.canClose && (settings?.collapsible ?? true)}
      resizable={policy.resizable}
      defaultSizePx={size?.defaultPx ?? PAGE_BOTTOM_SIZE.defaultPx}
      minSizePx={size?.minPx ?? PAGE_BOTTOM_SIZE.minPx}
      maxSizePx={size?.maxPx}
      contentMinSizePx={160}
      resizeLabel="Resize page bottom"
      onSizeChange={(height) => workbench.shell.setRegionSize("bottom", height)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || policy.canClose) workbench.shell.setRegionOpen("bottom", !collapsed);
      }}
      separator="line"
    />
  );
};
