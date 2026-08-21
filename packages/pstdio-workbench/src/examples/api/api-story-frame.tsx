import { Box, Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../../react";

interface ApiWorkbenchFrameProps {
  children?: ReactNode;
  workbench: WorkbenchCore;
}

export const ApiWorkbenchFrame = (props: ApiWorkbenchFrameProps) => {
  const { children, workbench } = props;
  const themePreferences = useWorkbenchThemePreferences(workbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Stack gap="md">
        {children}
        <Box h="480px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
          <Workbench workbench={workbench} />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  );
};
