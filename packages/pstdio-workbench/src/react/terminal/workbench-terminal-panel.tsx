import { Box, Center, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { Terminal, type TerminalBridge } from "@pstdio/ui/terminal";
import { useState } from "react";
import type { WorkbenchCore, WorkbenchTerminalController } from "../../core";

// Adapts the core terminal controller to the renderer-side `TerminalBridge`
// contract. Sessions opened by the panel land in the same controller registry
// the `terminal.session` webview capability uses, so host UI and extension
// webviews always see one session registry.
export const createControllerTerminalBridge = (terminal: WorkbenchTerminalController): TerminalBridge => ({
  async openSession(request) {
    const { sessionId } = await terminal.open({ request });
    return {
      id: sessionId,
      write: (data) => terminal.write({ sessionId, data }),
      resize: (cols, rows) => terminal.resize({ sessionId, cols, rows }),
      kill: (signal) => terminal.kill({ sessionId, signal }),
      onData: (handler) => terminal.subscribe(sessionId, { onData: handler }),
      onExit: (handler) => terminal.subscribe(sessionId, { onExit: handler }),
      onError: (handler) => terminal.subscribe(sessionId, { onError: handler }),
    };
  },
});

interface WorkbenchTerminalPanelProps {
  workbench: WorkbenchCore;
}

/**
 * Body of the host-owned terminal panel. Chrome (tab, title, close action,
 * resize) comes from the workbench `secondary` area; this component only mounts
 * the terminal bound to the workbench terminal controller. Closing the panel
 * unmounts the terminal, which kills its session (close = kill).
 */
export const WorkbenchTerminalPanel = (props: WorkbenchTerminalPanelProps) => {
  const { workbench } = props;
  const { themePreference } = useThemePreference();
  const [bridge] = useState(() => createControllerTerminalBridge(workbench.terminal));

  if (!workbench.terminal.isAvailable()) {
    return (
      <Center h="full" px="md">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Terminal sessions are not available in this workbench host.
        </Text>
      </Center>
    );
  }

  return (
    <Box h="full" minH="0" minW="0" w="full">
      <Terminal bridge={bridge} theme={/dark/i.test(themePreference) ? "dark" : "light"} />
    </Box>
  );
};
