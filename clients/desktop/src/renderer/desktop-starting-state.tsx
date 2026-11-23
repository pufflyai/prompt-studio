import { EmptyState, LogoLoader } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { DesktopStartupPhase } from "../lifecycle/lifecycle-machine";
import { CopyStartupDiagnosticsButton } from "./copy-startup-diagnostics-button";

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
  copyDiagnostics: () => Promise<void>;
  takingLonger?: boolean;
  waitingWithoutProgress?: boolean;
}

export const DesktopStartupProgress = (props: DesktopStartupProgressProps) => {
  const { phase, copyDiagnostics, takingLonger = false, waitingWithoutProgress = false } = props;
  const progressTitle = phase === "migrations" ? "Updating Prompt Studio" : "Opening Prompt Studio";
  let title = takingLonger ? "This is taking longer than usual" : progressTitle;
  if (waitingWithoutProgress) title = "Startup hasn’t reported progress for a while. Something may be wrong.";
  return (
    <EmptyState role="status" title={title} description={phaseCopy[phase]} icon={<LogoLoader />}>
      {takingLonger && <CopyStartupDiagnosticsButton copyDiagnostics={copyDiagnostics} />}
    </EmptyState>
  );
};

export const DesktopStartingState = (props: Pick<DesktopStartupProgressProps, "phase" | "copyDiagnostics">) => {
  const { phase, copyDiagnostics } = props;
  const [takingLonger, setTakingLonger] = useState(false);
  const [waitingPhase, setWaitingPhase] = useState<DesktopStartupPhase | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 10_000);
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
      copyDiagnostics={copyDiagnostics}
      takingLonger={takingLonger}
      waitingWithoutProgress={waitingPhase === phase}
    />
  );
};
