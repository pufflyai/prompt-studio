import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useState } from "react";
import { DesktopUpgradeButton, DesktopUpgradeDialog } from "./desktop-upgrade";

export default { title: "Product/Desktop/Upgrade" };

export const UpgradeEntryPoints = () => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);

  return (
    <Flex direction="column" height="full" minH="xs" justify="space-between">
      <Box as="header" p="sm" borderBottomWidth="1px">
        <Button
          size="sm"
          variant="ghost"
          disabled={installed}
          onClick={() => {
            setReady(true);
            setOpen(true);
          }}
        >
          Check for Updates…
        </Button>
      </Box>
      <Box p="md">
        <Text>{installed ? "Prompt Studio 0.49.0 is running" : "Prompt Studio 0.48.0 is running"}</Text>
        {!ready && !installed && (
          <Button size="sm" variant="outline" mt="sm" onClick={() => setReady(true)}>
            Simulate background download
          </Button>
        )}
      </Box>
      <Flex as="footer" align="center" justify="end" px="sm" h="8" borderTopWidth="1px">
        {ready && (
          <>
            <DesktopUpgradeButton onClick={() => setOpen(true)} />
            <DesktopUpgradeDialog
              version="0.49.0"
              open={open}
              onOpenChange={setOpen}
              onRestart={() => {
                setOpen(false);
                setReady(false);
                setInstalled(true);
              }}
            />
          </>
        )}
      </Flex>
    </Flex>
  );
};
