import { Box, Center, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { Terminal, type TerminalBridge } from "@pstdio/ui/terminal";
import { useEffect, useRef, useState } from "react";
import type { ResourceRef, WorkbenchCore, WorkbenchTerminalController, WorkbenchWidgetPlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface ControllerTerminalBridgeOptions {
  getResource?: () => ResourceRef | undefined;
  getTitle?: () => string | undefined;
}

const workspacePathFromResource = (resource: ResourceRef | undefined) => {
  const workspacePath = resource?.metadata?.workspacePath;
  return typeof workspacePath === "string" && workspacePath.length > 0 ? workspacePath : undefined;
};

const withTerminalRequestDefaults = (
  request: Parameters<TerminalBridge["openSession"]>[0],
  resource: ResourceRef | undefined,
) => {
  const cwd = workspacePathFromResource(resource);
  return cwd && !request.cwd ? { ...request, cwd } : request;
};

// Adapts the core terminal controller to the renderer-side `TerminalBridge`
// contract. Sessions opened by the panel land in the same controller registry
// the `terminal.session` webview capability uses, so host UI and extension
// webviews always see one session registry.
export const createControllerTerminalBridge = (
  terminal: WorkbenchTerminalController,
  options: ControllerTerminalBridgeOptions = {},
): TerminalBridge => ({
  async openSession(request) {
    const { sessionId } = await terminal.open({
      request: withTerminalRequestDefaults(request, options.getResource?.()),
      title: options.getTitle?.(),
    });
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
  placement: WorkbenchWidgetPlacement;
  workbench: WorkbenchCore;
}

/**
 * Body of the host-owned terminal panel. Chrome (tab, title, close action,
 * resize) comes from the workbench `secondary` area; this component only mounts
 * the terminal bound to the workbench terminal controller. Collapsing the panel
 * keeps the terminal mounted. Closing its tab unmounts the terminal and kills
 * its session (close = kill).
 */
export const WorkbenchTerminalPanel = (props: WorkbenchTerminalPanelProps) => {
  const { placement, workbench } = props;
  const { themePreference } = useThemePreference();
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const [bridge] = useState(() =>
    createControllerTerminalBridge(workbench.terminal, {
      getResource: () => placementRef.current.resource,
      getTitle: () => placementRef.current.title,
    }),
  );
  const [sessionId, setSessionId] = useState<string>();
  // The controller tracks the session's foreground process name; mirror it onto
  // the tab so terminals read like VSCode (e.g. `zsh`, `opencode`).
  const processTitle = useWorkbenchStore(workbench.terminal.store, (state) =>
    sessionId ? state.sessionsById[sessionId]?.title : undefined,
  );
  const active = useWorkbenchStore(workbench.layout.store, (state) => {
    const area = state.layout.areas.secondary;
    return (area.activeWidgetId ?? area.widgets[0]?.widgetId) === placement.widgetId;
  });

  useEffect(() => {
    if (!sessionId || !processTitle) return;
    workbench.layout.updateWidgetPlacement(placement.widgetId, { title: processTitle });
  }, [sessionId, processTitle, placement.widgetId, workbench.layout]);

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
      <Terminal
        bridge={bridge}
        theme={/dark/i.test(themePreference) ? "dark" : "light"}
        autoFocus={active}
        onSessionOpen={setSessionId}
      />
    </Box>
  );
};
