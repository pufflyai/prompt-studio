import { Spinner } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
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
  return (
    <EmptyState
      role="status"
      title={phase === "migrations" ? "Updating Prompt Studio" : "Opening Prompt Studio"}
      description={
        waitingWithoutProgress
          ? "Startup hasn’t reported progress for a while. Something may be wrong."
          : phaseCopy[phase]
      }
      icon={<Spinner size="lg" color="fg.muted" aria-hidden="true" _motionReduce={{ display: "none" }} />}
    >
      {takingLonger && <CopyStartupLogsButton copyStartupLogs={copyStartupLogs} />}
    </EmptyState>
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
