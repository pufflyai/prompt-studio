import { Tabs } from "@chakra-ui/react";
import type { WorkbenchCore, WorkbenchPanelRegion, WorkbenchWidgetPlacement } from "../../core";
import { useKeyboardTabs } from "../keybindings/use-keyboard-tabs";
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
  const { active, selectedId, tabs } = useKeyboardTabs(workbench);
  const numbers = new Map(tabs.map((tab) => [tab.id, tab.number]));
  return (
    <Tabs.List h="full" minH="0" w="full" alignItems="center" gap="2xs" justifyContent="flex-start">
      {placements.map((placement, index) => (
        <WorkbenchRegionTab
          key={placement.widgetId}
          workbench={workbench}
          placement={placement}
          shortcutNumber={active ? numbers.get(placement.widgetId) : undefined}
          keyboardSelected={active && selectedId === placement.widgetId}
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
