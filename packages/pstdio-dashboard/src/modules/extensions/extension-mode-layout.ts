import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  panelMenuDeclarationOffsets,
  registerWorkbenchExtensionPanel,
  toWorkbenchExtensionPlacementMetadata,
} from "@pstdio/workbench/extensions";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { modeOwnsNavigation, registerNavigationOwningMode } from "@/shared/workbench/mode-navigation-ownership";
import {
  dashboardExtensionViewKind,
  extensionModeLayoutRegion,
  extensionViewRegion as extensionViewRegionForPlacement,
  extensionViewWidgetId,
  extensionViewWidgetIdFor,
} from "./extension-view-placement";

export { extensionViewRegion } from "./extension-view-placement";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];
type DashboardExtensionPanel = DashboardExtensionMetadata["panels"][number];
type ModeLayoutOpenEntry = NonNullable<NonNullable<DashboardExtensionMode["layout"]>["open"]>[number];

const nativeModeResourceKinds = new Map([["sessions", { kind: "session", label: "Session", icon: "MessageCircle" }]]);
const openableLayoutRegions = new Set(["sidenav", "main", "secondary", "side", "activity", "status"]);
// Activity and status placements are not mode-scoped by the workbench, so extension
// chrome staged there must be swept when a mode that does not declare it takes over.
const modeScopedChromeRegions = ["activity", "status"] as const;

const modeStagesActivityChrome = (mode: DashboardExtensionMode) =>
  Boolean(mode.layout?.open?.some((entry) => extensionModeLayoutRegion(entry.region) === "activity"));

const resourceKindForMode = (mode: DashboardExtensionMode) =>
  nativeModeResourceKinds.get(mode.modeId) ??
  (mode.resourceKind
    ? {
        kind: mode.resourceKind,
        label: resolveLocalizableString(mode.label, mode.extensionId),
        icon: mode.icon,
      }
    : undefined);

const createExtensionViewResource = (input: {
  projectId: string;
  panel: DashboardExtensionPanel;
  title?: ModeLayoutOpenEntry["title"];
}) => ({
  kind: dashboardExtensionViewKind,
  uri: `dashboard-workbench://project/${input.projectId}/extension-views/${input.panel.id}`,
  id: input.panel.id,
  icon: input.panel.icon,
  label: input.title
    ? resolveLocalizableString(input.title, input.panel.extensionId)
    : resolveLocalizableString(input.panel.title, input.panel.extensionId),
  // The renderer derives which view to mount from the resource kind + cached manifest
  // (PS-11), so the view record is not stored on the resource. projectId stays — it is
  // domain-adjacent context the renderer needs to look the manifest up.
  metadata: {
    extensionId: input.panel.extensionId,
    projectId: input.projectId,
  },
});

const resolveResource = (ctx: WorkbenchModuleContext, resource: string) =>
  ctx.resources.listResources("").find((entry) => entry.resource.uri === resource || entry.resource.id === resource)
    ?.resource;

const seedModeEntry = (input: {
  ctx: WorkbenchModuleContext;
  entry: ModeLayoutOpenEntry;
  projectId: string;
  panelById: Map<string, DashboardExtensionPanel>;
  replacePanelInstanceId?: string;
}) => {
  const { ctx, entry, projectId, panelById, replacePanelInstanceId } = input;
  const region = extensionModeLayoutRegion(entry.region);
  if (openableLayoutRegions.has(region)) {
    ctx.panels.setOpen(region, true);
    ctx.layout.setRegionVisible(region, true);
  }
  // The Side Panel renders only while the shell presentation is attached, so a mode that
  // stages a side view must also reveal the panel itself.
  if (region === "side") ctx.sidePanel.setMode("attached");

  if (entry.panel) {
    const panel = panelById.get(entry.panel);
    if (!panel) throw new Error(`Extension mode panel not found: ${entry.panel}`);
    return ctx.layout.openPanel(extensionViewWidgetIdFor(panel), {
      region,
      pinned: entry.pinned,
      strategy: replacePanelInstanceId
        ? { kind: "replace-panel", instanceId: replacePanelInstanceId }
        : { kind: "persistent" },
      resource: createExtensionViewResource({ projectId, title: entry.title, panel }),
      title: entry.title
        ? resolveLocalizableString(entry.title, panel.extensionId)
        : resolveLocalizableString(panel.title, panel.extensionId),
    });
  }

  if (!entry.resource) return undefined;
  const resource = resolveResource(ctx, entry.resource);
  if (!resource) throw new Error(`Extension mode resource not found: ${entry.resource}`);
  return ctx.resources.openResource(resource);
};

const isResourceBoundModeEntry = (
  entry: ModeLayoutOpenEntry,
  mode: DashboardExtensionMode,
  panelById: Map<string, DashboardExtensionPanel>,
) => Boolean(entry.panel && mode.resourceKind && panelById.get(entry.panel)?.resourceKind === mode.resourceKind);

export const activateExtensionModeLayout = (input: {
  ctx: WorkbenchModuleContext;
  metadata: DashboardExtensionMetadata;
  mode: DashboardExtensionMode;
  projectId: string;
}) => {
  const { ctx, metadata, mode, projectId } = input;
  const panelById = new Map(metadata.panels.map((panel) => [panel.id, panel]));
  const entries = mode.layout?.open ?? [];

  for (const entry of entries) {
    if (entry.panel && !panelById.has(entry.panel)) throw new Error(`Extension mode panel not found: ${entry.panel}`);
    if (entry.resource && !resolveResource(ctx, entry.resource)) {
      throw new Error(`Extension mode resource not found: ${entry.resource}`);
    }
  }

  if (modeStagesActivityChrome(mode) || modeOwnsNavigation(mode.modeId)) ctx.layout.clearRegion("sidenav");

  for (const entry of entries) {
    if (isResourceBoundModeEntry(entry, mode, panelById)) continue;
    seedModeEntry({ ctx, entry, projectId, panelById });
  }
};

const activateExtensionModePanels = (input: {
  ctx: WorkbenchModuleContext;
  metadata: DashboardExtensionMetadata;
  mode: DashboardExtensionMode;
  projectId: string;
}) => {
  const panelById = new Map(input.metadata.panels.map((panel) => [panel.id, panel]));
  for (const entry of input.mode.layout?.open ?? []) {
    if (!entry.panel || extensionModeLayoutRegion(entry.region) === "main") continue;
    const panel = panelById.get(entry.panel);
    if (!panel) continue;
    const contributionId = extensionViewWidgetIdFor(panel);
    if (!input.ctx.layout.getPanel(contributionId)) continue;
    const region = extensionModeLayoutRegion(entry.region);
    const placement = (input.ctx.layout.getLayout().regions[region]?.widgets ?? [])
      .filter((candidate) => candidate.contributionId === contributionId)
      .at(-1);
    seedModeEntry({
      ctx: input.ctx,
      entry,
      projectId: input.projectId,
      panelById,
      replacePanelInstanceId: placement?.widgetId,
    });
  }
};

// Modal views mount in the overlay region as a closable dialog instead of docking
// into a workbench region; kanban-renderer create flows open them over the board.
const modalOverlayConfig = {
  size: "lg",
  placement: "center",
  scrollBehavior: "inside",
  closeOnEscape: false,
  closeOnInteractOutside: false,
  modal: true,
  preventScroll: true,
  trapFocus: true,
} as const;

const getModeIdsByViewId = (metadata: DashboardExtensionMetadata) => {
  const modeIdsByViewId = new Map<string, string[]>();

  for (const mode of metadata.modes) {
    for (const entry of mode.layout?.open ?? []) {
      if (!entry.panel) continue;
      const modeIds = modeIdsByViewId.get(entry.panel) ?? [];
      modeIdsByViewId.set(entry.panel, [...modeIds, mode.modeId]);
    }
  }

  return modeIdsByViewId;
};

const registerExtensionViews = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables: Disposable[] = [];
  const modeIdsByViewId = getModeIdsByViewId(metadata);
  const menuOffsets = panelMenuDeclarationOffsets(metadata.panels);

  metadata.panels.forEach((panel, index) => {
    if (!panel.webview) return;
    const modeIds = modeIdsByViewId.get(panel.id);
    const isModeLocation = panel.region === "main" && Boolean(modeIds?.length);
    const eligibleModeIds = isModeLocation ? undefined : modeIds;
    let resourceKinds: string[] | undefined;
    if (panel.resourceKind) resourceKinds = [panel.resourceKind];
    else if (isModeLocation) resourceKinds = [dashboardExtensionViewKind];
    disposables.push(
      registerWorkbenchExtensionPanel({
        workbench: ctx,
        contribution: {
          id: extensionViewWidgetId(panel.id),
          title: resolveLocalizableString(panel.title, panel.extensionId),
          icon: panel.icon,
          region: extensionViewRegionForPlacement(panel.region),
          closable: panel.closable,
          rendererId: dashboardWidgetIds.extensionView,
          config: { ...(panel.region === "overlay" ? modalOverlayConfig : {}), projectId },
          resourceKinds,
          ...toWorkbenchExtensionPlacementMetadata({ placement: panel.placement, declarationIndex: index }),
          eligibleLocations:
            eligibleModeIds || panel.eligibleLocations
              ? {
                  modeIds: eligibleModeIds,
                  resourceKinds: panel.eligibleLocations?.resourceKinds
                    ? [...panel.eligibleLocations.resourceKinds]
                    : undefined,
                }
              : undefined,
          panelMenus: panel.panelMenus?.map((menu, menuIndex) => {
            // Native-bodied menus render through their own renderer; only webview
            // menus mount in the generic extension-view widget.
            const nativeRendererId = menu.renderer?.id;
            return {
              id: nativeRendererId ? menu.id : extensionViewWidgetId(menu.id),
              title: resolveLocalizableString(menu.title, menu.extensionId),
              side: menu.side,
              rendererId: nativeRendererId ?? dashboardWidgetIds.extensionView,
              config: nativeRendererId ? undefined : { projectId },
              ...toWorkbenchExtensionPlacementMetadata({
                placement: menu.placement,
                declarationIndex: menuOffsets[index]! + menuIndex,
              }),
            };
          }),
        },
      }),
    );
  });

  return disposables;
};

const registerExtensionModes = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables: Disposable[] = [];

  const modeIdsWithActivityItems = new Set((metadata.activityItems ?? []).flatMap((item) => [...item.modes]));

  for (const mode of metadata.modes) {
    const resourceKind = resourceKindForMode(mode);
    if (resourceKind && !ctx.resources.getKind(resourceKind.kind)) {
      disposables.push(ctx.resources.registerKind(resourceKind));
    }

    if (!ctx.modes.getMode(mode.modeId)) {
      const ownsNavigation = modeStagesActivityChrome(mode) || modeIdsWithActivityItems.has(mode.modeId);
      if (ownsNavigation) disposables.push(registerNavigationOwningMode(mode.modeId));
      disposables.push(
        ctx.modes.registerMode({
          id: mode.modeId,
          label: resolveLocalizableString(mode.label, mode.extensionId),
          panels: mode.layout?.panels,
          activate: () => undefined,
          seed(modeCtx) {
            activateExtensionModeLayout({ ctx: modeCtx, metadata, mode, projectId });
          },
          enter: (modeCtx) => {
            const chrome = activateModeChromeContributions(modeCtx, mode.modeId);
            if (ownsNavigation) modeCtx.layout.clearRegion("sidenav");
            activateExtensionModePanels({ ctx: modeCtx, metadata, mode, projectId });
            return chrome;
          },
        }),
      );
    }
  }

  return disposables;
};

// Activity/status placements survive mode switches in the workbench, so extension
// chrome staged there is swept as soon as a mode it is not eligible for takes over.
const registerModeScopedChromeSweep = (ctx: WorkbenchModuleContext) =>
  ctx.modes.onDidChangeActive(() => {
    const activeModeId = ctx.modes.getActiveModeId();
    if (!activeModeId) return;
    for (const region of modeScopedChromeRegions) {
      for (const placement of ctx.layout.getLayout().regions[region]?.widgets ?? []) {
        const modeIds = ctx.layout.getPanel(placement.contributionId)?.eligibleLocations?.modeIds;
        if (modeIds && !modeIds.includes(activeModeId)) ctx.layout.removeWidgetPlacement(placement.widgetId);
      }
    }
  });

export const registerExtensionModeContributions = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables = [
    ...registerExtensionViews(ctx, metadata, projectId),
    ...registerExtensionModes(ctx, metadata, projectId),
  ];
  const chromeRegions: readonly string[] = modeScopedChromeRegions;
  if (metadata.panels.some((panel) => chromeRegions.includes(panel.region))) {
    disposables.push(registerModeScopedChromeSweep(ctx));
  }
  return disposables;
};
