import { Box } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useWorkbenchStore, WorkbenchFullscreenToggle, WorkbenchPanelToggles } from "@pstdio/workbench/react";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { ProjectHeader } from "./project-header";

/** App-wide controls use the same host slot as the desktop's project title bar. */
export const BrowserAppHeader = ({ workbench }: { workbench: WorkbenchCore }) => {
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const selected = useWorkbenchStore(
    workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  return (
    <Header aria-label="App header" bg="bg" color="fg" px="compact">
      <Box flex="1" minW="0" display={fullscreen ? "none" : undefined}>
        {typeof selected === "string" ? <ProjectHeader workbench={workbench} /> : null}
      </Box>
      {fullscreen ? <Box flex="1" /> : null}
      {typeof selected === "string" ? (
        <>
          {!fullscreen && <WorkbenchPanelToggles workbench={workbench} />}
          <WorkbenchFullscreenToggle workbench={workbench} />
        </>
      ) : null}
    </Header>
  );
};
