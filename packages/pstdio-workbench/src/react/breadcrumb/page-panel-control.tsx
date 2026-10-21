import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useId } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";
import { workbenchPanelRegions } from "../../core";
import { RegionTabMenu } from "../region/region-tab-menu";
import { useWorkbenchPanelRegionTabsState } from "../region/region-tabs-visibility-hooks";
import { useRegionTab } from "../region/use-region-tab";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface PagePanelControlProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  region: WorkbenchPanelRegion;
}

export const PagePanelControl = (props: { workbench: WorkbenchCore; placement: WorkbenchWidgetPlacement }) => {
  const { workbench, placement } = props;
  const region = useWorkbenchStore(workbench.layout.store, (state) =>
    workbenchPanelRegions.find((id) => state.layout.regions[id].widgets.some((p) => p.widgetId === placement.widgetId)),
  );
  return region ? <PagePanelTrayControl {...props} region={region} /> : null;
};

const PagePanelTrayControl = (props: PagePanelControlProps) => {
  const { workbench, region } = props;
  const { showTabs } = useWorkbenchPanelRegionTabsState(workbench, region);
  const policy = usePanelPolicy(workbench, region);
  // A placement has one drag source. Its tab takes over when a destination shows a tray.
  return showTabs && (policy.legacyHeaders || policy.showHeader) ? null : <PagePanelDragControl {...props} />;
};

const PagePanelDragControl = (props: PagePanelControlProps) => {
  const { workbench, placement } = props;
  const triggerId = useId();
  const behavior = useRegionTab({ workbench, placement, sortable: true }, triggerId);
  const { drag, snapshot } = behavior;
  if (workbench.getPanelDestinations(placement.widgetId).length < 2) return null;
  return (
    <>
      <Tooltip content="Drag panel or open move menu">
        <IconButton
          id={triggerId}
          ref={drag.setNodeRef}
          {...drag.listeners}
          data-workbench-page-drag={placement.widgetId}
          size="xs"
          variant="ghost"
          aria-label="Move page panel"
          aria-haspopup="menu"
          aria-expanded={behavior.menu.api.open}
          aria-keyshortcuts="Shift+F10"
          onContextMenu={behavior.onContextMenu}
          onKeyDown={behavior.onKeyDown}
          onClick={(event) => {
            if (!drag.isDragging) behavior.show(event.currentTarget);
          }}
        >
          <WorkbenchIcon name="GripVertical" size={14} />
        </IconButton>
      </Tooltip>
      <RegionTabMenu
        menu={behavior.menu}
        label={snapshot.label ?? placement.title ?? "Page panel"}
        groups={snapshot.menu ?? []}
        placement={placement}
        workbench={workbench}
      />
    </>
  );
};
