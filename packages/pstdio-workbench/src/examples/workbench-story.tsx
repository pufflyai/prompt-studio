import { Box } from "@chakra-ui/react";
import { Toaster } from "@pstdio/ui";
import type { WorkbenchCore } from "../core";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../react";

export interface WorkbenchStoryProps {
  workbench: WorkbenchCore;
}

// Mounts the workbench with the chrome a host supplies: a sizing box and the
// single `<Toaster />` viewport. The theme provider is fed from `workbench.themes`
// so it wraps that chrome too — themes contributed by the workbench restyle it.
export const WorkbenchStory = (props: WorkbenchStoryProps) => {
  const { workbench } = props;
  const themePreferences = useWorkbenchThemePreferences(workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Box h="100dvh" minH="0" minW="0" overflow="hidden" w="full">
        <Workbench workbench={workbench} />
      </Box>
      <Toaster />
    </WorkbenchThemeProvider>
  );
};
