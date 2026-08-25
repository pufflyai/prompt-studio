import type {
  Disposable,
  OpenWorkbenchViewInput,
  ResourceRef,
  WorkbenchModeActivationContext,
  WorkbenchModuleContext,
  WorkbenchPanelRegion,
  WorkbenchRegion,
} from "@pstdio/workbench";
import { workbenchPanelRegions } from "@pstdio/workbench";
import {
  listCompositionAddablePanels,
  panelMenuDeclarationOffsets,
  reconcileCompositionLayout,
  registerWorkbenchExtensionPanel,
  toWorkbenchCompositionPanelContribution,
  type WorkbenchCompositionRegistry,
} from "@pstdio/workbench/extensions";
import { selectDashboardNavigationView } from "@/shared/app/navigation-state";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { activateModeChromeContributions } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { setDashboardSidenavSelection } from "@/shared/workbench/dashboard-sidenav";
import { registerNavigationOwningMode } from "@/shared/workbench/mode-navigation-ownership";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import { createExtensionCompositionRegistry } from "./extension-composition";
import { registerExtensionStatusItems } from "./extension-status-items";

type DashboardExtensionMode = DashboardExtensionMetadata["modes"][number];

export const extensionViewResolveInput =
  (ctx: WorkbenchModuleContext, view: { id: string; title: string; icon?: string }) =>
  (openInput: OpenWorkbenchViewInput) => {
    selectDashboardNavigationView(ctx, view.id, { modeId: "project" });
    ctx.breadcrumbs.setItems([{ title: view.title, icon: view.icon }]);
    setDashboardSidenavSelection(ctx, view.id);
    return openInput;
  };

const dashboardResourceUri = (kind: string, id: string) => `dashboard-workbench://${kind}/${id}`;

const toModeDefaultResource = (input: {
  defaultResource: DashboardExtensionMode["defaultResource"];
  executeCommand: ExecuteDashboardExtensionCommand;
  projectId: string;
}): ResourceRef | (() => Promise<ResourceRef | undefined>) | undefined => {
  const { defaultResource, executeCommand, projectId } = input;
  if (!defaultResource) return undefined;

  const toResource = (value: { type: string; id: string; label?: string }) => ({
    kind: value.type,
    uri: dashboardResourceUri(value.type, value.id),
    id: value.id,
    label: value.label,
    metadata: { projectId },
  });

  if (!("commandId" in defaultResource)) return toResource(defaultResource);

  return async () => {
    const response = await executeCommand(projectId, defaultResource.commandId, { projectId });
    if (!response.outcome.ok) return undefined;
    const value = response.outcome.value as { type?: unknown; id?: unknown; label?: unknown } | undefined;
    if (typeof value?.type !== "string" || typeof value.id !== "string") return undefined;
    return toResource({
      type: value.type,
      id: value.id,
      label: typeof value.label === "string" ? value.label : undefined,
    });
  };
};

// Panels are docked-only, so a region the recipe filled must be revealed before its
// content can be seen. Only regions the recipe placed into are revealed, so a region
// the user collapsed on their own stays collapsed. The Side Panel renders only while
// the shell presentation is attached.
const revealPlacedRegions = (ctx: WorkbenchModuleContext, regions: Iterable<WorkbenchRegion>) => {
  for (const region of new Set(regions)) {
    ctx.panels.setOpen(region, true);
    ctx.layout.setRegionVisible(region, true);
    if (region === "side") ctx.sidePanel.setMode("attached");
  }
};

// The resolver places structure but knows nothing about resources. A placement made
// for a resource slot must carry the committed resource, or its webview renders with
// no resource and the resource presenter adds a second, bound copy beside it.
const bindResourceSlotPlacements = (
  ctx: WorkbenchModuleContext,
  input: { resource: ResourceRef; widgetIds: readonly string[] },
) => {
  const bind = (contributionId: string, title: string | undefined) => {
    for (const region of Object.values(ctx.layout.getLayout().regions)) {
      const placement = region.widgets.find((candidate) => candidate.contributionId === contributionId);
      if (!placement || placement.resourceUri === input.resource.uri) continue;
      ctx.layout.updateWidgetPlacement(placement.widgetId, { resource: input.resource, title });
    }
  };

  for (const widgetId of input.widgetIds) {
    bind(widgetId, input.resource.label);
    const panel = ctx.layout.getWidget(widgetId);
    for (const menuId of panel?.ownedPanelMenuIds ?? []) {
      const menu = ctx.layout.getWidget(menuId);
      bind(menuId, menu?.region.endsWith("left-menu") ? input.resource.label : menu?.title);
    }
  }
};

// The dashboard sidenav is host chrome that reopens on every mode change, so a mode
// that docks its own sidenav panel would lose the active tab to it. The mode's own
// panel wins, unless the user already selected another panel the mode placed there.
const activateModeSidenav = (ctx: WorkbenchModuleContext, placedPanelIds: readonly string[]) => {
  if (placedPanelIds.length === 0) return;
  const sidenav = ctx.layout.getLayout().regions.sidenav;
  const active = sidenav.widgets.find((widget) => widget.widgetId === sidenav.activeWidgetId);
  if (active && placedPanelIds.includes(active.contributionId)) return;
  const target = sidenav.widgets.find((widget) => placedPanelIds.includes(widget.contributionId));
  if (target) ctx.layout.setRegionActiveWidget("sidenav", target.widgetId);
};

const registerExtensionViews = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
) => {
  const disposables: Disposable[] = [];
  const menuOffsets = panelMenuDeclarationOffsets(metadata.panels);

  metadata.panels.forEach((panel, index) => {
    if (!panel.webview) return;
    const contribution = toWorkbenchCompositionPanelContribution({
      panel,
      rendererId: dashboardWidgetIds.extensionPanelRenderer,
      declarationIndex: index,
      menuDeclarationOffset: menuOffsets[index]!,
      resourcePanels: metadata.resourcePanels,
      config: { projectId },
    });
    const title = resolveLocalizableString(panel.title, panel.extensionId);
    disposables.push(
      registerWorkbenchExtensionPanel({
        workbench: ctx,
        path: panel.path,
        resolveInput: extensionViewResolveInput(ctx, { id: panel.id, title, icon: panel.icon }),
        contribution: {
          ...contribution,
          id: panel.id,
          title,
          panelMenus: panel.panelMenus?.map((menu, menuIndex) => {
            // Native-bodied menus render through their own renderer; only webview
            // menus mount in the generic extension panel widget.
            const nativeRendererId = menu.renderer?.id;
            return {
              id: menu.id,
              title: resolveLocalizableString(menu.title, menu.extensionId),
              side: menu.side,
              rendererId: nativeRendererId ?? dashboardWidgetIds.extensionPanelRenderer,
              config: nativeRendererId ? undefined : { projectId },
              priority: contribution.panelMenus?.[menuIndex]?.priority,
            };
          }),
        },
      }),
    );
  });

  return disposables;
};

// Resource kinds are declared by the manifest, so the workbench resource registry
// mirrors them instead of deriving a kind from each mode.
const registerCompositionResourceKinds = (ctx: WorkbenchModuleContext, metadata: DashboardExtensionMetadata) => {
  const disposables: Disposable[] = [];
  for (const kind of metadata.resourceKinds ?? []) {
    if (ctx.resources.getKind(kind.id)) continue;
    disposables.push(
      ctx.resources.registerKind({
        kind: kind.id,
        label: kind.label ?? kind.id,
        icon: kind.icon,
        surface: kind.surface,
      }),
    );
  }
  return disposables;
};

const registerExtensionModes = (input: {
  ctx: WorkbenchModuleContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: DashboardExtensionMetadata;
  projectId: string;
  registry: WorkbenchCompositionRegistry;
}) => {
  const { ctx, executeCommand, metadata, projectId, registry } = input;
  const disposables: Disposable[] = [];
  const modeIdsWithActivityItems = new Set((metadata.activityItems ?? []).flatMap((item) => [...item.modes]));

  for (const mode of metadata.modes) {
    if (ctx.modes.getMode(mode.modeId)) continue;

    // A mode that stages its own activity chrome owns navigation: the dashboard
    // sidenav must not sit beside it.
    const ownsNavigation = modeIdsWithActivityItems.has(mode.modeId);
    if (ownsNavigation) disposables.push(registerNavigationOwningMode(mode.modeId));

    // `seeding` distinguishes the two jobs. Only the mode registry knows which one
    // this is: it seeds a scope once and reconciles on every later activation, so the
    // recipe's optional placements open exactly on the first visit.
    const applyComposition = (modeCtx: WorkbenchModeActivationContext, seeding: boolean) => {
      if (ownsNavigation) modeCtx.layout.clearRegion("sidenav");
      const resource = modeCtx.navigator.getSelectedResource();
      const resolved = reconcileCompositionLayout(
        { layout: modeCtx.layout, notifications: modeCtx.notifications },
        { registry, modeId: mode.modeId, resourceKind: resource?.kind, seeding },
      );
      const placements = resolved?.placements ?? [];
      if (resource) {
        const resourcePanelWidgetIds = new Set(
          metadata.panels
            .filter((panel) => {
              const show = panel.show ? (Array.isArray(panel.show) ? panel.show : [panel.show]) : [];
              return (
                show.some((placement) => placement.for === resource.kind) ||
                (metadata.resourcePanels ?? []).some(
                  (edge) => edge.resourceKind === resource.kind && edge.panel === panel.id,
                )
              );
            })
            .map((panel) => panel.id),
        );
        bindResourceSlotPlacements(modeCtx, {
          resource,
          widgetIds: placements
            .filter((placement) => placement.slot || resourcePanelWidgetIds.has(placement.panelId))
            .map((placement) => placement.panelId),
        });
      }
      revealPlacedRegions(
        modeCtx,
        placements.map((placement) => placement.region),
      );
      activateModeSidenav(
        modeCtx,
        placements.filter((placement) => placement.region === "sidenav").map((placement) => placement.panelId),
      );
    };

    disposables.push(
      ctx.modes.registerMode({
        id: mode.modeId,
        label: resolveLocalizableString(mode.label, mode.extensionId),
        panels: mode.panelRegions,
        // Extension modes declare their accepted kinds explicitly so the atomic
        // navigator rejects incompatible resources instead of keeping them.
        resourceKinds: Object.keys(mode.resources ?? {}),
        defaultResource: toModeDefaultResource({
          defaultResource: mode.defaultResource,
          executeCommand,
          projectId,
        }),
        listAddablePanels: ({ layout, resource }) =>
          listCompositionAddablePanels({
            registry,
            modeId: mode.modeId,
            layout,
            resourceKind: resource?.kind,
          }).filter((panel): panel is typeof panel & { region: WorkbenchPanelRegion } =>
            workbenchPanelRegions.includes(panel.region as WorkbenchPanelRegion),
          ),
        activate: () => undefined,
        // The workbench establishes the mode's Location around `seed`, so the first
        // composition pass must run there for the main panel to own its Panel Menus.
        seed: (modeCtx) => applyComposition(modeCtx, true),
        enter: (modeCtx) => activateModeChromeContributions(modeCtx, mode.modeId),
        reconcile: (modeCtx) => applyComposition(modeCtx, false),
      }),
    );
  }

  return disposables;
};

export const registerExtensionModeContributions = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
  projectId: string,
  executeCommand: ExecuteDashboardExtensionCommand = executeExtensionCommand,
  // Composition spans extensions: one extension may place a panel another extension
  // contributed into an open slot. Callers registering one extension at a time pass
  // the registry built from the complete metadata so those edges still resolve.
  registry: WorkbenchCompositionRegistry = createExtensionCompositionRegistry(metadata),
) => [
  ...registerExtensionViews(ctx, metadata, projectId),
  ...metadata.routes.map((route) =>
    registerWorkbenchExtensionPanel({
      workbench: ctx,
      path: route.path,
      resolveInput: extensionViewResolveInput(ctx, {
        id: route.id,
        title: resolveLocalizableString(route.label, route.extensionId),
      }),
      contribution: {
        id: route.id,
        title: resolveLocalizableString(route.label, route.extensionId),
        region: "main",
        rendererId: dashboardWidgetIds.extensionPanelRenderer,
        singleton: true,
        config: { projectId },
      },
    }),
  ),
  ...registerExtensionStatusItems(ctx, metadata, projectId),
  ...registerCompositionResourceKinds(ctx, metadata),
  ...registerExtensionModes({ ctx, executeCommand, metadata, projectId, registry }),
];
