import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { createDesktopUpgrade, DesktopUpgradeConfirmation } from "../desktop-upgrade";

export default { title: "Product/Desktop/Upgrade", fullscreen: true };

export const UpgradeEntryPoints = () => {
  const [state, setState] = useState<"current" | "downloading" | "ready" | "installed">("current");
  const [workbench] = useState(() => createWorkbench());
  const [upgrade] = useState(
    () =>
      createDesktopUpgrade({
        restartToInstallUpdate: async () => setState("installed"),
      })!,
  );
  useEffect(() => {
    upgrade.update(state === "ready" ? { version: "0.49.0" } : null);
    if (state !== "downloading") return;
    const completeDownload = setTimeout(() => setState("ready"), 3000);
    return () => clearTimeout(completeDownload);
  }, [state, upgrade]);

  return (
    <Box h="full" minH="xs">
      <DesktopUpgradeConfirmation workbench={workbench} upgrade={upgrade} />
      <Workbench
        workbench={workbench}
        titleBar={
          <Flex as="header" p="sm" gap="sm" align="center">
            <Button
              size="sm"
              variant="ghost"
              loading={state === "downloading"}
              loadingText="Downloading update…"
              onClick={() => {
                if (state === "current") setState("downloading");
              }}
            >
              Check for Updates…
            </Button>
            <Button size="sm" variant="outline" onClick={() => setState("downloading")}>
              Simulate automatic check
            </Button>
            <Text>{state === "installed" ? "Prompt Studio 0.49.0 is running" : "Prompt Studio 0.48.0 is running"}</Text>
          </Flex>
        }
      />
    </Box>
  );
};
