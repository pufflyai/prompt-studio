import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { openDashboardTerminalSession } from "@/shared/terminal/api-terminal-session-opener";

/** Backs workbench terminal sessions with the API PTY transport. */
export const createTerminalModule = () =>
  ({
    id: "dashboard.terminal",
    activate(ctx) {
      ctx.terminal.setSessionOpener(openDashboardTerminalSession);
      return [{ dispose: () => ctx.terminal.setSessionOpener(null) }];
    },
  }) satisfies WorkbenchModuleContribution;
