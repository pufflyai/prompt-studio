import { Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { DesktopStartupPhase } from "../lifecycle/lifecycle-machine";

const phaseCopy: Record<DesktopStartupPhase, string> = {
  discovery: "Connecting to Prompt Studio on your computer…",
  verification: "Checking the app files…",
  environment: "Loading your local tools…",
  spawning: "Starting Prompt Studio in the background…",
  database: "Preparing your local data…",
  retiring: "Backing up data from your previous version…",
  migrations: "Updating your local data…",
  extensions: "Loading your tools…",
  readiness: "Preparing your workbench…",
};

interface DesktopStartupProgressProps {
  phase: DesktopStartupPhase;
  takingLonger?: boolean;
}

export const DesktopStartupProgress = (props: DesktopStartupProgressProps) => {
  const { phase, takingLonger = false } = props;
  return (
    <Stack align="center" gap="lg" role="status" aria-live="polite">
      <Spinner size="lg" color="fg.muted" aria-hidden="true" _motionReduce={{ display: "none" }} />
      <Stack align="center" gap="xs" textAlign="center">
        <Heading textStyle="heading/M">Opening Prompt Studio</Heading>
        <Text color="fg.muted" textStyle="paragraph/M/regular">
          {phaseCopy[phase]}
        </Text>
        {takingLonger && (
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            This is taking longer than usual. Prompt Studio is still starting. You can keep waiting.
          </Text>
        )}
      </Stack>
    </Stack>
  );
};

export const DesktopStartingState = (props: { phase: DesktopStartupPhase }) => {
  const { phase } = props;
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 20_000);
    return () => clearTimeout(timer);
  }, []);
  return <DesktopStartupProgress phase={phase} takingLonger={takingLonger} />;
};
