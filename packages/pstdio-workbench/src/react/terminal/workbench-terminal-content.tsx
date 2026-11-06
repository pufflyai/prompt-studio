import { Box, Center, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { createTerminalThemeFromPreference, Terminal } from "@pstdio/ui/terminal";
import { type ComponentProps, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { createControllerTerminalBridge } from "./controller-terminal-bridge";
import type { WorkbenchTerminalPanel } from "./workbench-terminal-panel";

/**
 * Body of the host-owned terminal panel. Chrome (tab, title, close action,
 * resize) comes from the workbench `secondary` region; this component only mounts
 * the terminal bound to the workbench terminal controller. Collapsing the panel
 * keeps the terminal mounted. Scope changes keep the session alive; the terminal
 * module ends it when its tab is explicitly closed.
 */
export const WorkbenchTerminalContent = (props: ComponentProps<typeof WorkbenchTerminalPanel>) => {
  const { placement, workbench } = props;
  const { themePreference, themePreferences } = useThemePreference();
  const preference = themePreferences.find((theme) => theme.id === themePreference)!;
  const placementRef = useRef(placement);
  // A layout effect runs before the terminal's passive effect opens a session,
  // so a session opened in the same commit reads the current placement.
  useLayoutEffect(() => {
    placementRef.current = placement;
  }, [placement]);
  const [bridge] = useState(() =>
    createControllerTerminalBridge(workbench.terminal, {
      getBindingId: () => placementRef.current.instanceId,
      getResource: () => placementRef.current.resource,
      getTitle: () => placementRef.current.title,
    }),
  );
  const [sessionId, setSessionId] = useState<string>();
  // The terminal resource label follows the session's foreground process name.
  const processTitle = useWorkbenchStore(workbench.terminal.store, (state) =>
    sessionId ? state.sessionsById[sessionId]?.title : undefined,
  );
  const keyboardActive = useWorkbenchStore(workbench.keyboard.store, (state) => state.active);
  const active = useWorkbenchStore(workbench.layout.store, (state) => {
    const region = Object.values(state.layout.regions).find((region) =>
      region.widgets.some((candidate) => candidate.widgetId === placement.instanceId),
    );
    if (!region) return false;
    return (region.activeWidgetId ?? region.widgets[0]?.widgetId) === placement.instanceId;
  });
  const updateShellPlacement = workbench.shellPlacements.updatePlacement;

  useEffect(() => {
    if (!sessionId || !processTitle) return;
    const currentPlacement = workbench.layout.getLayout().regions;
    const current = Object.values(currentPlacement)
      .flatMap((region) => region.widgets)
      .find((candidate) => candidate.widgetId === placement.instanceId);
    const identity = current?.placementIdentity;
    if (identity?.kind === "shell" && current?.resource) {
      updateShellPlacement(identity, { resource: { ...current.resource, label: processTitle } });
    }
  }, [sessionId, processTitle, placement.instanceId, workbench.layout, updateShellPlacement]);

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
        theme={createTerminalThemeFromPreference(preference)}
        autoFocus={active && !keyboardActive}
        killOnUnmount={false}
        onSessionOpen={setSessionId}
      />
    </Box>
  );
};
