import { Box } from "@chakra-ui/react";
import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchWidgetHost } from "./widget-host";

export const useModeChrome = (workbench: WorkbenchCore, region: WorkbenchRegion) =>
  useWorkbenchStore(workbench.modes.store, (state) => {
    const mode = state.activeModeId ? state.modes[state.activeModeId] : undefined;
    if (region !== "nav" && region !== "sidenav" && region !== "activity" && region !== "status") return undefined;
    return mode?.chrome?.[region];
  });

export const ModeChromeView = (props: { workbench: WorkbenchCore; viewId: string; region: WorkbenchRegion }) => {
  const { workbench, viewId, region } = props;
  return (
    <Box h="full" w="full" minH="0" position="relative">
      <Box position="absolute" inset="0" display="flex">
        <WorkbenchWidgetHost
          key={viewId}
          workbench={workbench}
          region={region}
          placement={{ widgetId: viewId, contributionId: viewId, viewId, closable: false }}
        />
      </Box>
    </Box>
  );
};
