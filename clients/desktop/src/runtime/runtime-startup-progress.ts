import type { DesktopStartupPhase } from "../lifecycle/lifecycle-machine";

const startupPhases: Record<string, DesktopStartupPhase> = {
  database_locked: "database",
  database_engine_loaded: "database",
  database_retiring: "retiring",
  database_retired: "database",
  database_image_restored: "database",
  database_opened: "migrations",
  database_migrated: "extensions",
  extensions_ready: "readiness",
  app_ready: "readiness",
};

export const readRuntimeStartupPhase = (output: string) => {
  for (const line of output.split("\n").reverse()) {
    try {
      const entry = JSON.parse(line);
      if (entry?.event === "runtime.startup.phase" && Object.hasOwn(startupPhases, entry.phase)) {
        return startupPhases[entry.phase];
      }
    } catch {
      // The bounded output tail can start or end in the middle of a log entry.
    }
  }
  return undefined;
};

export const observeRuntimeStartup = (readOutput: () => string, onPhase: (phase: DesktopStartupPhase) => void) => {
  let previous: DesktopStartupPhase | undefined;
  const timer = setInterval(() => {
    const phase = readRuntimeStartupPhase(readOutput());
    if (phase && phase !== previous) {
      previous = phase;
      onPhase(phase);
    }
  }, 100);
  return () => clearInterval(timer);
};
