import type { CommandModule } from "yargs";
import { runProcessObserver } from "@/features/performance/process-observer";

export const performanceObserverCommand = {
  command: "performance-observer",
  describe: false,
  handler: runProcessObserver,
} satisfies CommandModule;
