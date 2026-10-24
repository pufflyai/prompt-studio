import type { DbOpenPhase } from "pstdio-db";
import { startupLogger } from "./logger";

export type StartupPhase = DbOpenPhase | "extensions_ready" | "app_ready";

// Time since process start puts every step of one startup on the same clock, including Bun's own launch.
export const logStartupPhase = (phase: StartupPhase) => {
  startupLogger.info(
    { event: "runtime.startup.phase", phase, elapsedMs: Math.round(performance.now()) },
    "Runtime startup progress",
  );
};
