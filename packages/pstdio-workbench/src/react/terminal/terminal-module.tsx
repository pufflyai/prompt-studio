import {
  type WorkbenchCoreContributionContext,
  type WorkbenchModuleContribution,
  workbenchAreaTabLeadingMenuPath,
} from "../../core";
import { WorkbenchTerminalPanel } from "./workbench-terminal-panel";

// The host-owned terminal panel in the workbench `secondary` (bottom) area.
// Exported so hosts can open or assert it directly.
export const WORKBENCH_TERMINAL_WIDGET_ID = "workbench.terminal";

// Built-in command to open (or focus) the terminal panel. Registered by the
// surface module so it is available in the command palette without host wiring.
export const WORKBENCH_TERMINAL_OPEN_COMMAND_ID = "workbench.terminal.open";

const RENDERER_ID = "workbench.terminal.renderer";
const LAUNCHER_RENDERER_ID = "workbench.terminal.launcher.renderer";
type OpenWorkbenchTerminalInput = NonNullable<Parameters<WorkbenchCoreContributionContext["layout"]["openWidget"]>[1]>;

export const WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID = "workbench.terminal.launcher";

const ensureTerminalLauncher = (ctx: WorkbenchCoreContributionContext) => {
  const existing = ctx.layout
    .getLayout()
    .areas.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID);
  if (existing) return existing;

  return ctx.layout.openWidget(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, {
    hiddenByDefault: true,
    pinned: true,
    title: "Terminal",
  });
};

const terminalTitlePattern = /^Terminal (\d+)$/;

const getNextTerminalTitle = (ctx: WorkbenchCoreContributionContext) => {
  const terminalIndexes = ctx.layout
    .getLayout()
    .areas.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID)
    .map((placement) => terminalTitlePattern.exec(placement.title ?? "")?.[1])
    .filter((index): index is string => index !== undefined)
    .map((index) => Number.parseInt(index, 10));
  const nextIndex = Math.max(0, ...terminalIndexes) + 1;
  return `Terminal ${nextIndex}`;
};

// Opens a new terminal placement, revealing the bottom area if it is collapsed.
export const openWorkbenchTerminal = (
  ctx: WorkbenchCoreContributionContext,
  input: OpenWorkbenchTerminalInput = {},
) => {
  ensureTerminalLauncher(ctx);
  const placement = ctx.layout.openWidget(WORKBENCH_TERMINAL_WIDGET_ID, {
    ...input,
    title: input.title ?? getNextTerminalTitle(ctx),
  });
  ctx.layout.setAreaVisible("secondary", true);
  ctx.panels.setOpen("secondary", true);
  return placement;
};

/**
 * Host-owned terminal surface: tabbed placements in the `secondary` area whose
 * chrome, focus, lifecycle, and styling belong to the workbench. Sessions are
 * owned by `workbench.terminal` (the same registry the `terminal.session`
 * webview capability uses); the host injects a session opener via
 * `workbench.terminal.setSessionOpener(...)`. Closing a tab kills its session;
 * disposing the controller kills every live session.
 */
export const createWorkbenchTerminalModule = (): WorkbenchModuleContribution => ({
  id: "workbench.terminal.surface",
  activate(ctx) {
    return [
      ctx.layout.registerWidget({
        id: WORKBENCH_TERMINAL_WIDGET_ID,
        title: "Terminal",
        area: "secondary",
        singleton: false,
        reuse: "none",
        closable: true,
        mountStrategy: "keep-mounted",
        rendererId: RENDERER_ID,
        areaSize: { defaultPx: 240, minPx: 120 },
      }),
      ctx.renderers.registerRenderer({
        id: RENDERER_ID,
        render: (input) => <WorkbenchTerminalPanel placement={input.placement} workbench={input.workbench} />,
      }),
      ctx.renderers.registerRenderer({ id: LAUNCHER_RENDERER_ID, render: () => null }),
      ctx.layout.registerWidget({
        id: WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
        title: "Terminal",
        area: "secondary",
        singleton: true,
        closable: false,
        hiddenByDefault: true,
        rendererId: LAUNCHER_RENDERER_ID,
        areaSize: { defaultPx: 240, minPx: 120 },
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
      ctx.layout.registerMenuItem(workbenchAreaTabLeadingMenuPath("secondary"), {
        commandId: WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
        label: "New terminal",
        icon: "Plus",
        order: -100,
      }),
    ];
  },
});
