import { Box } from "@chakra-ui/react";
import { Header, ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { pageHasBottom } from "../../core/registries/pages/page-panel-menus";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

const PAGE_BOTTOM_SIZE = { defaultPx: 160, minPx: 80 };

const PageBottomPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
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
      <Header
        variant="main"
        data-workbench-panel-header="bottom"
        flexShrink={0}
        gap="xs"
        display={page?.regionSettings?.bottom?.showHeader === false ? "none" : "flex"}
      >
        <WorkbenchRegionTabs workbench={workbench} region="bottom" />
        <WorkbenchPanelMenuOpeners workbench={workbench} panel="bottom" />
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
  const bottom = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.bottom);
  const settings = page?.regionSettings?.bottom;
  const size = workbench.layout.getRegionSize("bottom");
  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide="bottom"
      contentPanel={children}
      resizablePanel={<PageBottomPanel workbench={workbench} />}
      collapsed={!pageHasBottom(page) || bottom.widgets.length === 0 || !bottom.visible}
      collapsible={settings?.collapsible ?? true}
      defaultSizePx={size?.defaultPx ?? PAGE_BOTTOM_SIZE.defaultPx}
      minSizePx={size?.minPx ?? PAGE_BOTTOM_SIZE.minPx}
      maxSizePx={size?.maxPx}
      contentMinSizePx={160}
      resizeLabel="Resize page bottom"
      onSizeChange={(height) => workbench.layout.setRegionSize("bottom", height)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || settings?.collapsible !== false) workbench.layout.setRegionVisible("bottom", !collapsed);
      }}
      separator="line"
    />
  );
};
