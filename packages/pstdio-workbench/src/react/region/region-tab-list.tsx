import { Tabs } from "@chakra-ui/react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";
import { WorkbenchRegionTab } from "./workbench-region-tab";

interface RegionTabListProps {
  activeWidgetId?: string;
  disabled: boolean;
  panelRegion?: WorkbenchPanelRegion;
  placements: WorkbenchWidgetPlacement[];
  workbench: WorkbenchCore;
}
export const RegionTabList = (props: RegionTabListProps) => {
  const { activeWidgetId, disabled, panelRegion, placements, workbench } = props;
  return (
    <Tabs.List h="full" minH="0" w="full" alignItems="center" gap="2xs" justifyContent="flex-start">
      {placements.map((placement, index) => (
        <WorkbenchRegionTab
          key={placement.widgetId}
          workbench={workbench}
          placement={placement}
          activeWidgetId={activeWidgetId}
          disabled={disabled}
          region={panelRegion}
          sortable={Boolean(panelRegion && workbench.getPanelDestinations(placement.widgetId).length)}
          previousWidgetId={placements[index - 1]?.widgetId}
          nextWidgetId={placements[index + 1]?.widgetId}
        />
      ))}
    </Tabs.List>
  );
};
