import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { DesktopUpgradeButton, DesktopUpgradeDialog } from "./desktop-upgrade";

export default { title: "Product/Desktop/Upgrade" };

export const UpgradeEntryPoints = () => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"current" | "downloading" | "ready" | "installed">("current");
  const [waiting, setWaiting] = useState(false);
  const available = state === "downloading" || state === "ready";
  const installed = state === "installed";
  useEffect(() => {
    if (state !== "downloading") return;
    const completeDownload = setTimeout(() => {
      setState(waiting ? "installed" : "ready");
      if (waiting) setOpen(false);
    }, 3000);
    return () => clearTimeout(completeDownload);
  }, [state, waiting]);

  return (
    <Flex direction="column" height="full" minH="xs" justify="space-between">
      <Box as="header" p="sm" borderBottomWidth="1px">
        <Button
          size="sm"
          variant="ghost"
          disabled={installed}
          onClick={() => {
            if (state === "current") setState("downloading");
            setOpen(true);
          }}
        >
          Check for Updates…
        </Button>
      </Box>
      <Box p="md">
        <Text>{installed ? "Prompt Studio 0.49.0 is running" : "Prompt Studio 0.48.0 is running"}</Text>
        {state === "current" && (
          <Button size="sm" variant="outline" mt="sm" onClick={() => setState("downloading")}>
            Simulate update found
          </Button>
        )}
      </Box>
      <Flex as="footer" align="center" justify="end" px="sm" h="8" borderTopWidth="1px">
        {available && (
          <>
            <DesktopUpgradeButton onClick={() => setOpen(true)} />
            <DesktopUpgradeDialog
              version="0.49.0"
              open={open}
              ready={state === "ready"}
              waiting={waiting}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setWaiting(false);
              }}
              onRestart={() => {
                if (state === "downloading") {
                  setWaiting(true);
                  return;
                }
                setOpen(false);
                setState("installed");
              }}
            />
          </>
        )}
      </Flex>
    </Flex>
  );
};
