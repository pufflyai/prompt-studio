import type { WorkbenchCoreContributionContext, WorkbenchModuleContribution } from "../../core";
import { WorkbenchTerminalPanel } from "./workbench-terminal-panel";

// The host-owned terminal panel in the workbench `secondary` (bottom) area.
// Exported so hosts can open or assert it directly.
export const WORKBENCH_TERMINAL_WIDGET_ID = "workbench.terminal";

// Built-in command to open (or focus) the terminal panel. Registered by the
// surface module so it is available in the command palette without host wiring.
export const WORKBENCH_TERMINAL_OPEN_COMMAND_ID = "workbench.terminal.open";

const RENDERER_ID = "workbench.terminal.renderer";

// Opens the terminal panel, revealing the bottom area if it is collapsed.
// A second open focuses the existing singleton placement instead of duplicating it.
export const openWorkbenchTerminal = (ctx: WorkbenchCoreContributionContext) => {
  const placement = ctx.layout.openWidget(WORKBENCH_TERMINAL_WIDGET_ID, { pinned: true });
  ctx.layout.setAreaVisible("secondary", true);
  ctx.panels.setOpen("secondary", true);
  return placement;
};

/**
 * Host-owned terminal surface: a singleton panel in the `secondary` area whose
 * chrome, focus, lifecycle, and styling belong to the workbench. Sessions are
 * owned by `workbench.terminal` (the same registry the `terminal.session`
 * webview capability uses); the host injects a session opener via
 * `workbench.terminal.setSessionOpener(...)`. Closing the panel kills its
 * session; disposing the controller kills every live session.
 */
export const createWorkbenchTerminalModule = (): WorkbenchModuleContribution => ({
  id: "workbench.terminal.surface",
  activate(ctx) {
    return [
      ctx.layout.registerWidget({
        id: WORKBENCH_TERMINAL_WIDGET_ID,
        title: "Terminal",
        area: "secondary",
        singleton: true,
        closable: true,
        rendererId: RENDERER_ID,
        areaSize: { defaultPx: 240, minPx: 120 },
      }),
      ctx.renderers.registerRenderer({
        id: RENDERER_ID,
        render: (input) => <WorkbenchTerminalPanel workbench={input.workbench} />,
      }),
      ctx.commands.registerCommand(
        {
          id: WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
          label: "Open terminal",
          category: "Terminal",
          icon: "SquareTerminal",
        },
        { execute: () => openWorkbenchTerminal(ctx) },
      ),
    ];
  },
});
