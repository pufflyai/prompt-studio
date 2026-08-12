import { Box, Button, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { DesktopState } from "../lifecycle/lifecycle-machine";

const phaseCopy = {
  discovery: "Looking for your local Prompt Studio runtime…",
  spawning: "Starting the Prompt Studio runtime…",
  readiness: "Waiting for the workbench to become ready…",
} as const;

interface DesktopLifecycleActions {
  cancelQuit: () => Promise<void>;
  confirmQuit: () => Promise<void>;
  copyDiagnostics: () => Promise<void>;
  openLogs: () => Promise<void>;
  quitApp: () => Promise<void>;
  retryRuntime: () => Promise<void>;
}

interface DesktopLifecycleViewProps {
  actions?: DesktopLifecycleActions;
  state: DesktopState;
}

const desktopActions: DesktopLifecycleActions = {
  cancelQuit: () => window.promptStudioDesktop.cancelQuit(),
  confirmQuit: () => window.promptStudioDesktop.confirmQuit(),
  copyDiagnostics: () => window.promptStudioDesktop.copyDiagnostics(),
  openLogs: () => window.promptStudioDesktop.openLogs(),
  quitApp: () => window.promptStudioDesktop.quitApp(),
  retryRuntime: () => window.promptStudioDesktop.retryRuntime(),
};

const useDesktopState = () => {
  const [state, setState] = useState<DesktopState>({ kind: "starting", phase: "discovery" });
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await window.promptStudioDesktop.getStartupState();
      if (active) setState(next);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 150);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);
  return state;
};

const useReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const StartingState = (props: { phase: keyof typeof phaseCopy }) => {
  const { phase } = props;
  const reducedMotion = useReducedMotion();
  return (
    <Stack align="center" gap="lg" role="status" aria-live="polite">
      {!reducedMotion && <Spinner size="lg" color="fg.muted" aria-hidden="true" />}
      <Stack align="center" gap="xs" textAlign="center">
        <Heading textStyle="heading/M">Opening Prompt Studio</Heading>
        <Text color="fg.muted" textStyle="paragraph/M/regular">
          {phaseCopy[phase]}
        </Text>
      </Stack>
    </Stack>
  );
};

const RecoveryState = (props: {
  actions: DesktopLifecycleActions;
  state: Extract<DesktopState, { kind: "recovery" }>;
}) => {
  const { actions, state } = props;
  const availableActions = new Set(state.error.actions);
  return (
    <SimpleCard width="full">
      <SimpleCardBody>
        <Stack gap="lg" role="alert">
          <Stack gap="xs">
            <Heading textStyle="heading/M">Prompt Studio needs attention</Heading>
            <AlertMessage status="error" title={state.error.code}>
              {state.error.message}
            </AlertMessage>
          </Stack>
          <HStack gap="xs" flexWrap="wrap">
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

const activityGroups = (state: Extract<DesktopState, { kind: "confirming_active_work" }>) => [
  { label: "Agent sessions", items: state.activity.sessions },
  { label: "Terminals", items: state.activity.terminals },
  { label: "Jobs", items: state.activity.jobs },
];

const ActiveWorkState = (props: {
  actions: DesktopLifecycleActions;
  state: Extract<DesktopState, { kind: "confirming_active_work" }>;
}) => {
  const { actions, state } = props;
  return (
    <SimpleCard width="full">
      <SimpleCardBody>
        <Stack
          gap="lg"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="active-work-title"
          aria-describedby="active-work-description"
        >
          <Stack gap="xs">
            <Heading id="active-work-title" textStyle="heading/M">
              Active work is still running
            </Heading>
            <Text id="active-work-description" color="fg.muted" textStyle="paragraph/M/regular">
              Canceling this work will stop the items below. This cannot be undone.
            </Text>
          </Stack>
          <Stack gap="sm">
            {activityGroups(state).map((group) => {
              if (group.items.length === 0) return null;
              return (
                <Box key={group.label} bg="bg.muted" borderRadius="xs" px="sm" py="xs">
                  <Text textStyle="label/S/medium" color="fg.muted">
                    {group.label}
                  </Text>
                  <Stack as="ul" gap="2xs" listStyle="none" padding="0" margin="0" mt="2xs">
                    {group.items.map((item) => (
                      <Text as="li" key={item.id} textStyle="paragraph/M/regular">
                        {item.label}
                      </Text>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          <HStack gap="xs" justify="flex-end" flexWrap="wrap">
            <Button autoFocus onClick={actions.cancelQuit}>
              Keep Prompt Studio open
            </Button>
            <Button variant="destructive" onClick={actions.confirmQuit}>
              Cancel work and quit
            </Button>
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

const ClosingState = () => {
  const reducedMotion = useReducedMotion();
  return (
    <Stack align="center" gap="lg" role="status" aria-live="polite">
      {!reducedMotion && <Spinner size="lg" color="fg.muted" aria-hidden="true" />}
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
  const { actions = desktopActions, state } = props;
  return (
    <Box as="main" minHeight="100vh" bg="bg" color="fg" display="grid" placeItems="center" padding="xl">
      <Box width="full" maxWidth="2xl">
        {state.kind === "starting" && <StartingState phase={state.phase} />}
        {state.kind === "recovery" && <RecoveryState actions={actions} state={state} />}
        {state.kind === "confirming_active_work" && <ActiveWorkState actions={actions} state={state} />}
        {state.kind === "closing" && <ClosingState />}
      </Box>
    </Box>
  );
};

export const DesktopLifecycleApp = () => {
  const state = useDesktopState();
  return <DesktopLifecycleView state={state} />;
};
