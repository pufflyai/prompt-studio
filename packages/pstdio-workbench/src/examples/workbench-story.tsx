import { Box } from "@chakra-ui/react";
import type { WorkbenchCore } from "../core";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../react";

export interface WorkbenchStoryProps {
  workbench: WorkbenchCore;
}

// Mounts the workbench inside host story chrome. The theme provider is fed from
// `workbench.themes` so themes contributed by the workbench restyle the frame too.
export const WorkbenchStory = (props: WorkbenchStoryProps) => {
  const { workbench } = props;
  const themePreferences = useWorkbenchThemePreferences(workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Box h="100dvh" minH="0" minW="0" overflow="hidden" w="full">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
