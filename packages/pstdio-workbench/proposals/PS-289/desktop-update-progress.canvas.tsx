import { Button, HStack, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { createWorkbench } from "../../src/core";
import { WorkbenchThemeProvider } from "../../src/react/theme/workbench-theme-provider";
import { WorkbenchStatusBar } from "../../src/react/workbench/workbench-panels";

export default { title: "Proposals/PS-289 Desktop update progress" };

export const DesktopUpdateProgress = () => {
  const [workbench] = useState(() => createWorkbench());
  const showNotice = (title: string, level: "info" | "error" = "info") => {
    workbench.notifications.show({ id: "desktop.update", title, level });
  };

  return (
    <WorkbenchThemeProvider>
      <Stack gap="md" minH="16rem">
        <HStack>
          <Button size="sm" onClick={() => showNotice("Checking for updates…")}>
            Check for updates
          </Button>
          <Button size="sm" onClick={() => showNotice("Downloading update…")}>
            Start download
          </Button>
          <Button size="sm" onClick={() => showNotice("Your update is ready to install.")}>
            Finish download
          </Button>
          <Button size="sm" onClick={() => showNotice("Prompt Studio couldn't complete the update.", "error")}>
            Fail update
          </Button>
        </HStack>
        <WorkbenchStatusBar workbench={workbench} />
      </Stack>
    </WorkbenchThemeProvider>
  );
};
