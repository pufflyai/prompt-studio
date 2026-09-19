import { Box } from "@chakra-ui/react";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useRetainedViewPlacements } from "./use-retained-view-placements";
import { WorkbenchWidgetHost } from "./widget-host";

export const useModeChrome = (workbench: WorkbenchCore, region: WorkbenchRegion) =>
  useWorkbenchStore(workbench.modes.store, (state) => {
    const mode = state.activeModeId ? state.modes[state.activeModeId] : undefined;
    if (region !== "nav" && region !== "sidenav" && region !== "activity" && region !== "status") return undefined;
    return mode?.chrome?.[region];
  });

export const ModeChromeView = (props: { workbench: WorkbenchCore; viewId?: string; region: WorkbenchRegion }) => {
  const { workbench, viewId, region } = props;
  const placements = useRetainedViewPlacements(
    workbench,
    viewId ? [{ widgetId: viewId, contributionId: viewId, viewId, closable: false }] : [],
  );
  return (
    <Box h="full" w="full" minH="0" position="relative" display={viewId ? "block" : "none"}>
      {placements.map((placement) => (
        <Box
          key={placement.widgetId}
          position="absolute"
          inset="0"
          display={placement.viewId === viewId ? "flex" : "none"}
          inert={placement.viewId !== viewId}
        >
          <WorkbenchWidgetHost workbench={workbench} region={region} placement={placement} />
        </Box>
      ))}
    </Box>
  );
};
