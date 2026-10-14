import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { geometryEdge } from "../../core/registries/layout/panel-geometry";
import { WorkbenchFocusRegion } from "../focus/focus-region";
import { WorkbenchPanelMenuLayout, WorkbenchPanelMenuOpeners } from "../panel-menu/panel-menu";
import { PanelDragHandle } from "../region/panel-drag-area";
import { PanelHeaderContextMenu, PanelHeaderEdge } from "../region/panel-header-menu";
import { WorkbenchRegion } from "../region/region";
import { WorkbenchRegionTabs } from "../region/region-tabs";
import { WorkbenchTabDropTarget } from "../region/tab-drag-context";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { workbenchBackgrounds } from "../theme/workbench-theme-background";

export const WorkbenchPagePanel = (props: { workbench: WorkbenchCore; region: "aside" | "bottom" }) => {
  const { workbench, region } = props;
  const policy = usePanelPolicy(workbench, region);
  return (
    <WorkbenchFocusRegion
      workbench={workbench}
      region={region}
      data-workbench-panel={region}
      data-workbench-region={region}
      bg={workbenchBackgrounds.panel}
      layerStyle={region === "aside" ? "pageSidePanel" : undefined}
      display="flex"
      flexDirection="column"
      h="full"
      minH="0"
      minW="0"
      position="relative"
      overflow="hidden"
    >
      <PanelHeaderEdge workbench={workbench} region={region} visible={policy.showHeader} />
      <PanelHeaderContextMenu workbench={workbench} region={region}>
        <PanelDragHandle workbench={workbench} panel={region} asChild>
          <Header
            tabIndex={0}
            aria-label={`${region} header`}
            variant="main"
            data-workbench-panel-header={region}
            flexShrink={0}
            gap="xs"
            display={policy.showHeader ? "flex" : "none"}
          >
            <WorkbenchRegionTabs workbench={workbench} region={region} />
            <WorkbenchPanelMenuOpeners workbench={workbench} panel={region} />
          </Header>
        </PanelDragHandle>
      </PanelHeaderContextMenu>
      <WorkbenchTabDropTarget workbench={workbench} region={region} />
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <WorkbenchPanelMenuLayout workbench={workbench} panel={region}>
          <WorkbenchRegion
            workbench={workbench}
            region={region}
            title={region === "aside" ? "Page side" : "Page bottom"}
          />
        </WorkbenchPanelMenuLayout>
      </Box>
    </WorkbenchFocusRegion>
  );
};

export const usePagePanelGeometry = (workbench: WorkbenchCore, region: "aside" | "bottom") => {
  const settings = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId]?.regionSettings?.[region] : undefined,
  );
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const state = layout.regions[region];
  return { settings, size: state.size ?? settings?.size?.defaultPx, edge: geometryEdge(layout, region) };
};
