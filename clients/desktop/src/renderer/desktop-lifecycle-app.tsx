import { Box, Button, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, ScrollArea, SimpleCard, SimpleCardBody, WindowTitleBar } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { DesktopStartingState } from "./desktop-starting-state";

interface DesktopLifecycleActions {
  copyDiagnostics: () => Promise<void>;
  openLogs: () => Promise<void>;
  quitApp: () => Promise<void>;
  retryRuntime: () => Promise<void>;
}

interface DesktopLifecycleViewProps {
  actions?: DesktopLifecycleActions;
  state: DesktopState;
  platform?: string;
}

const desktopActions: DesktopLifecycleActions = {
  copyDiagnostics: () => window.promptStudioDesktop.copyDiagnostics(),
  openLogs: () => window.promptStudioDesktop.openLogs(),
  quitApp: () => window.promptStudioDesktop.quitApp(),
  retryRuntime: () => window.promptStudioDesktop.retryRuntime(),
};

const useDesktopState = (initialState: DesktopState) => {
  const [state, setState] = useState(initialState);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await window.promptStudioDesktop.getStartupState();
      if (active) setState(next);
    };
    const unsubscribe = window.promptStudioDesktop.onStartupState(setState);
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return state;
};

const RecoveryState = (props: {
  actions: DesktopLifecycleActions;
  state: Extract<DesktopState, { kind: "recovery" }>;
}) => {
  const { actions, state } = props;
  const availableActions = new Set(state.error.actions);
  return (
    <SimpleCard width="full" maxHeight="full" display="flex" minHeight="0">
      <SimpleCardBody display="flex" minHeight="0" width="full">
        <Stack gap="lg" role="alert" minHeight="0" minWidth="0" width="full">
          <Heading textStyle="heading/M" flexShrink="0">
            Prompt Studio needs attention
          </Heading>
          <ScrollArea minHeight="0" contentProps={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
            <AlertMessage status="error" title={state.error.code}>
              {state.error.message}
            </AlertMessage>
          </ScrollArea>
          <HStack gap="xs" flexWrap="wrap" flexShrink="0">
            {availableActions.has("retry") && <Button onClick={actions.retryRuntime}>Retry</Button>}
            {availableActions.has("open_logs") && (
              <Button variant="outline" onClick={actions.openLogs}>
                Open logs
              </Button>
            )}
            {availableActions.has("copy_diagnostics") && (
              <Button variant="outline" onClick={actions.copyDiagnostics}>
                Copy diagnostics
              </Button>
            )}
            {availableActions.has("quit") && (
              <Button variant="ghost" onClick={actions.quitApp}>
                Quit
              </Button>
            )}
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const ClosingState = () => {
  return (
    <Stack align="center" gap="lg" role="status" aria-live="polite">
      <Spinner size="lg" color="fg.muted" aria-hidden="true" _motionReduce={{ display: "none" }} />
      <Stack align="center" gap="xs" textAlign="center">
        <Heading textStyle="heading/M">Closing Prompt Studio</Heading>
        <Text color="fg.muted" textStyle="paragraph/M/regular">
          Waiting for the runtime to finish safely. This can take a while.
        </Text>
      </Stack>
    </Stack>
  );
};

export const DesktopLifecycleView = (props: DesktopLifecycleViewProps) => {
  const { actions = desktopActions, state, platform = "darwin" } = props;
  // Electron includes covered renderers in native drag hit testing. Only the
  // active surface may contribute a title bar, or it blocks workbench controls.
  // The quit confirmation is a dialog inside the workbench.
  if (state.kind === "workbench" || state.kind === "confirming_active_work") return null;

  return (
    <Stack as="main" width="full" height="100dvh" overflow="hidden" bg="bg" color="fg" gap="0">
      <WindowTitleBar platform={platform} />
      <Box flex="1" minHeight="0" display="flex" justifyContent="center" padding="xl">
        <Box width="full" maxWidth="2xl" height="full" display="flex" alignItems="center" justifyContent="center">
          {state.kind === "starting" && <DesktopStartingState phase={state.phase} />}
          {state.kind === "recovery" && <RecoveryState actions={actions} state={state} />}
          {state.kind === "closing" && <ClosingState />}
        </Box>
      </Box>
    </Stack>
  );
};

export const DesktopLifecycleApp = (props: { initialState: DesktopState; platform: string }) => {
  const { initialState, platform } = props;
  const state = useDesktopState(initialState);
  return <DesktopLifecycleView state={state} platform={platform} />;
};
