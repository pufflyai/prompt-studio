import { Box, Button, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { DesktopState } from "../lifecycle/lifecycle-machine";

const phaseCopy = {
  discovery: "Looking for your local Prompt Studio runtime…",
  spawning: "Starting the Prompt Studio runtime…",
  readiness: "Waiting for the workbench to become ready…",
} as const;

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

const StartingState = (props: { phase: keyof typeof phaseCopy }) => {
  const { phase } = props;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Stack align="center" gap="lg" role="status" aria-live="polite">
      {!reducedMotion && <Spinner size="lg" color="fg.muted" />}
      <Stack align="center" gap="xs">
        <Heading textStyle="heading/M">Opening Prompt Studio</Heading>
        <Text color="fg.muted" textStyle="paragraph/M/regular">
          {phaseCopy[phase]}
        </Text>
      </Stack>
    </Stack>
  );
};

const RecoveryState = (props: { state: Extract<DesktopState, { kind: "recovery" }> }) => {
  const { state } = props;
  const actions = new Set(state.error.actions);
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
            {actions.has("retry") && <Button onClick={() => window.promptStudioDesktop.retryRuntime()}>Retry</Button>}
            {actions.has("open_logs") && (
              <Button variant="outline" onClick={() => window.promptStudioDesktop.openLogs()}>
                Open logs
              </Button>
            )}
            {actions.has("copy_diagnostics") && (
              <Button variant="outline" onClick={() => window.promptStudioDesktop.copyDiagnostics()}>
                Copy diagnostics
              </Button>
            )}
            {actions.has("quit") && (
              <Button variant="ghost" onClick={() => window.promptStudioDesktop.quitApp()}>
                Quit
              </Button>
            )}
          </HStack>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};

export const DesktopLifecycleApp = () => {
  const state = useDesktopState();
  return (
    <Box as="main" minHeight="100vh" bg="bg" color="fg" display="grid" placeItems="center" padding="xl">
      <Box width="full" maxWidth="2xl">
        {state.kind === "starting" && <StartingState phase={state.phase} />}
        {state.kind === "recovery" && <RecoveryState state={state} />}
        {state.kind === "confirming_active_work" && (
          <Text role="status" aria-live="assertive">
            Waiting for quit confirmation…
          </Text>
        )}
        {state.kind === "closing" && (
          <Stack align="center" gap="xs" role="status" aria-live="polite">
            <Heading textStyle="heading/M">Closing Prompt Studio</Heading>
            <Text color="fg.muted">Waiting for the runtime to finish safely. This can take a while.</Text>
          </Stack>
        )}
      </Box>
    </Box>
  );
};
