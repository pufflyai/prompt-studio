import { Box } from "@chakra-ui/react";
import { useState } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../../react";

interface OnboardingFrameProps {
  createWorkbench: () => WorkbenchCore;
}

export const OnboardingFrame = (props: OnboardingFrameProps) => {
  const { createWorkbench } = props;
  const [workbench] = useState(createWorkbench);
  const themePreferences = useWorkbenchThemePreferences(workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Box h="520px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
