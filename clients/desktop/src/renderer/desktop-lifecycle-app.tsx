import { Box, Button, Heading, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { EmptyState, LogoLoader, resolveIconComponent, ScrollArea, WindowTitleBar } from "@pstdio/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { DesktopState } from "../lifecycle/lifecycle-machine";
import { CopyStartupDiagnosticsButton } from "./copy-startup-diagnostics-button";
import {
  createDesktopRecoveryFeedback,
  type DesktopRecoveryAction,
  observeDesktopStartupState,
} from "./desktop-recovery-feedback";
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

const RecoveryIcon = resolveIconComponent("circle-alert");

const useDesktopState = (initialState: DesktopState) => {
  const [state, setState] = useState(initialState);
  useEffect(() => observeDesktopStartupState(window.promptStudioDesktop, setState), []);
  return state;
};

const recoveryErrors = {
  retry: "The retry could not start. Try again.",
  open_logs: "Prompt Studio could not open the logs.",
  quit: "The quit request could not be confirmed.",
} satisfies Record<DesktopRecoveryAction, string>;

const RecoveryState = (props: {
  actions: DesktopLifecycleActions;
  state: Extract<DesktopState, { kind: "recovery" }>;
}) => {
  const { actions, state } = props;
  const availableActions = new Set(state.error.actions);
  const [feedback] = useState(createDesktopRecoveryFeedback);
  const statuses = useSyncExternalStore(feedback.subscribe, feedback.snapshot, feedback.snapshot);
  const run = (action: DesktopRecoveryAction, execute: () => Promise<void>) => {
    void feedback.run(action, execute);
  };
  return (
    <ScrollArea width="full" maxHeight="full" viewportProps={{ maxHeight: "full" }}>
      <EmptyState
        role="alert"
        title="Prompt Studio needs attention"
        description={state.error.message}
        icon={<Icon as={RecoveryIcon} color="fg.error" aria-hidden="true" />}
      >
        <HStack gap="xs" flexWrap="wrap" justify="center">
          {availableActions.has("retry") && (
            <Button loading={statuses.get("retry") === "pending"} onClick={() => run("retry", actions.retryRuntime)}>
              Retry
            </Button>
          )}
          {availableActions.has("open_logs") && (
            <Button
              variant="outline"
              loading={statuses.get("open_logs") === "pending"}
              onClick={() => run("open_logs", actions.openLogs)}
            >
              Open logs
            </Button>
          )}
          <CopyStartupDiagnosticsButton variant="outline" copyDiagnostics={actions.copyDiagnostics} />
          {availableActions.has("quit") && (
            <Button
              variant="ghost"
              loading={statuses.get("quit") === "pending"}
              onClick={() => run("quit", actions.quitApp)}
            >
              Quit
            </Button>
          )}
        </HStack>
        {[...statuses]
          .filter(([, status]) => status === "failed")
          .map(([action]) => (
            <Text key={action} role="alert" color="fg.error">
              {recoveryErrors[action]}
            </Text>
          ))}
      </EmptyState>
    </ScrollArea>
  );
};

const ClosingState = () => {
  return (
    <Stack align="center" gap="lg" role="status" aria-live="polite">
      <LogoLoader />
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
          {state.kind === "starting" && (
            <DesktopStartingState phase={state.phase} copyDiagnostics={actions.copyDiagnostics} />
          )}
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
