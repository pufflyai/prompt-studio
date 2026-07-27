import type { WorkbenchCoreContributionContext, WorkbenchModuleContribution } from "../../core";
import { WorkbenchTerminalPanel } from "./workbench-terminal-panel";

// The host-owned terminal panel in the workbench `secondary` (bottom) region.
// Exported so hosts can open or assert it directly.
export const WORKBENCH_TERMINAL_WIDGET_ID = "workbench.terminal";

// Built-in command to open (or focus) the terminal panel. Registered by the
// surface module so it is available in the command palette without host wiring.
export const WORKBENCH_TERMINAL_OPEN_COMMAND_ID = "workbench.terminal.open";

const RENDERER_ID = "workbench.terminal.renderer";
const LAUNCHER_RENDERER_ID = "workbench.terminal.launcher.renderer";
const TERMINAL_PANEL_SIZE = { defaultPx: 240, minPx: 128 };
type OpenWorkbenchTerminalInput = NonNullable<Parameters<WorkbenchCoreContributionContext["layout"]["openWidget"]>[1]>;
type OpenWorkbenchTerminalOptions = OpenWorkbenchTerminalInput & {
  reveal?: boolean;
};
type TerminalResource = OpenWorkbenchTerminalOptions["resource"];

export const WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID = "workbench.terminal.launcher";

const ensureTerminalLauncher = (ctx: WorkbenchCoreContributionContext) => {
  const existing = ctx.layout
    .getLayout()
    .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID);
  if (existing) return existing;

  return ctx.layout.openPanel(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID, {
    hiddenByDefault: true,
    pinned: true,
    title: "Terminal",
  });
};

const terminalTitlePattern = /^Terminal (\d+)$/;
const nextTerminalIndexes = new WeakMap<WorkbenchCoreContributionContext["layout"]["store"], number>();

const getInitialTerminalIndex = (ctx: WorkbenchCoreContributionContext) => {
  const terminalPlacements = ctx.layout
    .getLayout()
    .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
  const titleIndexes = terminalPlacements
    .map((placement) => terminalTitlePattern.exec(placement.title ?? "")?.[1])
    .filter((index): index is string => index !== undefined)
    .map((index) => Number.parseInt(index, 10));
  return Math.max(terminalPlacements.length, ...titleIndexes) + 1;
};

const getNextTerminalTitle = (ctx: WorkbenchCoreContributionContext) => {
  const nextIndex = Math.max(nextTerminalIndexes.get(ctx.layout.store) ?? 1, getInitialTerminalIndex(ctx));
  nextTerminalIndexes.set(ctx.layout.store, nextIndex + 1);
  return `Terminal ${nextIndex}`;
};

const hasWorkspacePath = (resource: TerminalResource) =>
  typeof resource?.metadata?.workspacePath === "string" && resource.metadata.workspacePath.length > 0;

const getTerminalResource = (ctx: WorkbenchCoreContributionContext, resource: TerminalResource) => {
  const activeResource = ctx.getActiveResource();
  const primaryResource = ctx.getPrimaryResource();
  return (
    (hasWorkspacePath(resource) ? resource : undefined) ??
    (hasWorkspacePath(activeResource) ? activeResource : undefined) ??
    (hasWorkspacePath(primaryResource) ? primaryResource : undefined) ??
    resource ??
    primaryResource
  );
};

// Opens a new terminal placement, revealing the bottom region if it is collapsed.
export const openWorkbenchTerminal = (
  ctx: WorkbenchCoreContributionContext,
  input: OpenWorkbenchTerminalOptions = {},
) => {
  const { reveal = true, ...openInput } = input;
  const resource = getTerminalResource(ctx, openInput.resource);
  ensureTerminalLauncher(ctx);
  const placement = ctx.layout.openPanel(WORKBENCH_TERMINAL_WIDGET_ID, {
    ...openInput,
    resource,
    title: openInput.title ?? getNextTerminalTitle(ctx),
  });
  if (reveal) {
    ctx.layout.setRegionVisible("secondary", true);
    ctx.panels.setOpen("secondary", true);
  }
  return placement;
};

/**
 * Host-owned terminal surface: tabbed placements in the `secondary` region whose
 * chrome, focus, lifecycle, and styling belong to the workbench. Sessions are
 * owned by `workbench.terminal` (the same registry the `terminal.session`
 * webview capability uses); the host injects a session opener via
 * `workbench.terminal.setSessionOpener(...)`. Closing a tab kills its session;
 * disposing the controller kills every live session.
 */
export const createWorkbenchTerminalModule = (): WorkbenchModuleContribution => ({
  id: "workbench.terminal.surface",
  activate(ctx) {
    const disposables = [
      ctx.layout.registerPanel({
        id: WORKBENCH_TERMINAL_WIDGET_ID,
        title: "Terminal",
        region: "secondary",
        singleton: false,
        reuse: "none",
        closable: true,
        mountStrategy: "keep-mounted",
        rendererId: RENDERER_ID,
        openCommandId: WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
        eligibleLocations: {},
        regionSize: TERMINAL_PANEL_SIZE,
      }),
      ctx.renderers.registerRenderer({
        id: RENDERER_ID,
        render: (input) => <WorkbenchTerminalPanel placement={input.instance} workbench={input.workbench} />,
      }),
      ctx.renderers.registerRenderer({ id: LAUNCHER_RENDERER_ID, render: () => null }),
      ctx.layout.registerPanel({
        id: WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
        title: "Terminal",
        region: "secondary",
        singleton: true,
        closable: false,
        hiddenByDefault: true,
        rendererId: LAUNCHER_RENDERER_ID,
        regionSize: TERMINAL_PANEL_SIZE,
      }),
      ctx.commands.registerCommand(
        {
          id: WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
          label: "Open terminal",
          category: "Terminal",
          icon: "SquareTerminal",
        },
        { execute: (_args, context) => openWorkbenchTerminal(ctx, { resource: context?.resource }) },
      ),
    ];

    ensureTerminalLauncher(ctx);
    return disposables;
  },
});
