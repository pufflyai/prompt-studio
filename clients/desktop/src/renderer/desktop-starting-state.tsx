import { Heading, Spinner, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { DesktopStartupPhase } from "../lifecycle/lifecycle-machine";
import { CopyStartupLogsButton } from "./copy-startup-logs-button";

const phaseCopy: Record<DesktopStartupPhase, string> = {
  discovery: "Connecting to Prompt Studio on your computer…",
  verification: "Checking the app files…",
  environment: "Loading your local tools…",
  spawning: "Starting Prompt Studio in the background…",
  database: "Preparing your local data…",
  retiring: "Backing up data from your previous version…",
  migrations: "Updating your local data…",
  cleanup: "Cleaning up stale data…",
  compacting: "Reclaiming space after the update…",
  extensions: "Loading your tools…",
  readiness: "Preparing your workbench…",
};

interface DesktopStartupProgressProps {
  phase: DesktopStartupPhase;
  copyStartupLogs: () => Promise<void>;
  takingLonger?: boolean;
  waitingWithoutProgress?: boolean;
}

export const DesktopStartupProgress = (props: DesktopStartupProgressProps) => {
  const { phase, copyStartupLogs, takingLonger = false, waitingWithoutProgress = false } = props;
  const updating = phase === "migrations" || phase === "cleanup" || phase === "compacting";
  return (
    <Stack align="center" gap="lg">
      <Stack align="center" gap="lg" role="status">
        <Spinner size="lg" color="fg.muted" aria-hidden="true" _motionReduce={{ display: "none" }} />
        <Stack align="center" gap="xs" textAlign="center">
          <Heading textStyle="heading/M">{updating ? "Updating Prompt Studio" : "Opening Prompt Studio"}</Heading>
          <Text color="fg.muted" textStyle="paragraph/M/regular">
            {phaseCopy[phase]}
          </Text>
        </Stack>
      </Stack>
      {takingLonger && (
        <AlertMessage
          status="neutral"
          variant="surface"
          colorPalette="gray"
          role="status"
          title="This is taking longer than usual."
          endElement={<CopyStartupLogsButton copyStartupLogs={copyStartupLogs} />}
        >
          {waitingWithoutProgress
            ? "Startup hasn’t reported progress for a while. Something may be wrong."
            : "Prompt Studio is still starting, but slowly."}
        </AlertMessage>
      )}
    </Stack>
  );
};

export const DesktopStartingState = (props: Pick<DesktopStartupProgressProps, "phase" | "copyStartupLogs">) => {
  const { phase, copyStartupLogs } = props;
  const [takingLonger, setTakingLonger] = useState(false);
  const [waitingPhase, setWaitingPhase] = useState<DesktopStartupPhase | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 15_000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    setWaitingPhase(null);
    const timer = setTimeout(() => setWaitingPhase(phase), 5 * 60_000);
    return () => clearTimeout(timer);
  }, [phase]);
  return (
    <DesktopStartupProgress
      phase={phase}
      copyStartupLogs={copyStartupLogs}
      takingLonger={takingLonger}
      waitingWithoutProgress={waitingPhase === phase}
    />
  );
};
