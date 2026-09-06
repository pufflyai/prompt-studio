import type { ResourceRef, WorkbenchCoreContributionContext, WorkbenchModuleContribution } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import { terminalPlacementBindingId } from "./terminal-placement-binding";
import { WorkbenchTerminalPanel } from "./workbench-terminal-panel";
// The host-owned terminal panel in the workbench `secondary` (bottom) region.
// Exported so hosts can open or assert it directly.
export const WORKBENCH_TERMINAL_WIDGET_ID = "workbench.terminal";
// Built-in command to open (or focus) the terminal panel. Registered by the
// surface module so it is available in the command palette without host wiring.
export const WORKBENCH_TERMINAL_OPEN_COMMAND_ID = "workbench.terminal.open";
/** Suggested secondary-region size for hosts that mount the terminal (createWorkbench regionSettings). */
export const WORKBENCH_TERMINAL_PANEL_SIZE = { defaultPx: 240, minPx: 128 };
interface OpenWorkbenchTerminalOptions {
  resource?: ResourceRef;
  reveal?: boolean;
}
type TerminalResource = OpenWorkbenchTerminalOptions["resource"];
const terminalInstanceIds = (ctx: WorkbenchCoreContributionContext) =>
  new Set(
    ctx.layout
      .listPanelInstances("secondary")
      .filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID)
      .map((placement) => placement.instanceId),
  );
const watchClosedTerminalPlacements = (ctx: WorkbenchCoreContributionContext) => {
  // A scope rotation temporarily removes every placement. Only an explicit tab
  // close should end the PTY bound to that placement.
  let changingScope = false;
  const willChangeScope = ctx.layout.onWillChangePersistenceScope(() => {
    changingScope = true;
  });
  const didChangeScope = ctx.layout.onDidChangePersistenceScope(() => {
    changingScope = false;
  });
  const unsubscribeLayout = ctx.layout.store.subscribe((state, previousState) => {
    if (changingScope) return;
    const currentIds = new Set(
      state.layout.regions.secondary.widgets
        .filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID)
        .map((placement) => placement.widgetId),
    );
    const previousIds = previousState.layout.regions.secondary.widgets
      .filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID)
      .map((placement) => placement.widgetId);
    const scope = ctx.layout.getPersistenceScope();
    for (const instanceId of previousIds) {
      if (!currentIds.has(instanceId)) void ctx.terminal.killBinding(terminalPlacementBindingId(scope, instanceId));
    }
  });
  return {
    dispose() {
      unsubscribeLayout();
      willChangeScope.dispose();
      didChangeScope.dispose();
      const scope = ctx.layout.getPersistenceScope();
      for (const instanceId of terminalInstanceIds(ctx)) {
        void ctx.terminal.killBinding(terminalPlacementBindingId(scope, instanceId));
      }
    },
  };
};
const terminalTitlePattern = /^Terminal (\d+)$/;
const nextTerminalIndexes = new WeakMap<WorkbenchCoreContributionContext["layout"]["store"], number>();
const getInitialTerminalIndex = (ctx: WorkbenchCoreContributionContext) => {
  const terminalPlacements = ctx.layout
    .getLayout()
    .regions.secondary.widgets.filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
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
  const { reveal = true } = input;
  const workspace = getTerminalResource(ctx, input.resource);
  const title = getNextTerminalTitle(ctx);
  const index = Number.parseInt(terminalTitlePattern.exec(title)?.[1] ?? "1", 10);
  const id = `${String(index).padStart(8, "0")}-${globalThis.crypto.randomUUID()}`;
  const resource: ResourceRef = {
    type: "terminal",
    id,
    label: title,
    icon: "SquareTerminal",
    metadata: workspace?.metadata,
  };
  const identity = ctx.shellPlacements.openPlacement({
    placementId: WORKBENCH_TERMINAL_WIDGET_ID,
    resource,
    open: "pin",
    title,
  });
  if (identity.kind !== "shell") throw new Error("Terminal placement must be shell-owned");
  if (reveal) {
    ctx.shell.setRegionOpen("secondary", true);
  }
  const placement = ctx.layout
    .getLayout()
    .regions.secondary.widgets.find(
      (candidate) =>
        candidate.placementIdentity?.kind === "shell" &&
        candidate.placementIdentity.placementId === identity.placementId &&
        candidate.placementIdentity.instanceKey === identity.instanceKey,
    );
  if (!placement) throw new Error(`Terminal placement did not open: ${identity.instanceKey}`);
  return toPanelInstance(placement);
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
      ctx.views.registerView({
        id: WORKBENCH_TERMINAL_WIDGET_ID,
        title: "Terminal",
        body: {
          kind: "react",
          render: (input) => <WorkbenchTerminalPanel placement={input.instance} workbench={input.workbench} />,
        },
      }),
      ctx.shellPlacements.registerPlacement({
        id: WORKBENCH_TERMINAL_WIDGET_ID,
        item: {
          kind: "binding",
          binding: {
            kinds: [
              {
                kind: "resource-kind",
                id: "terminal",
              },
            ],
            view: {
              kind: "view",
              id: WORKBENCH_TERMINAL_WIDGET_ID,
            },
            cardinality: "many",
            add: { kind: "command", target: { command: { kind: "command", id: WORKBENCH_TERMINAL_OPEN_COMMAND_ID } } },
          },
        },
        region: "secondary",
        mountStrategy: "keep-mounted",
        // Background flows mint terminals without user intent; a closed Secondary
        // Panel must stay closed until an explicit open reveals it.
        hiddenByDefault: true,
      }),
      watchClosedTerminalPlacements(ctx),
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
    return disposables;
  },
});
