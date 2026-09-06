import type { ResourceRef as PageResourceRef } from "@pstdio/sdk/extensions";
import type { LayoutModel, WorkbenchRegion } from "../../registries/layout/layout-model";
import { createPlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import {
  applyOwnedWidgetLayoutReconciliation,
  reconcileOwnedWidgetLayout,
} from "../../registries/layout/owned-placement-layout";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import { activateWorkbenchPageMode } from "../../registries/modes/mode-registry-internals";
import {
  createWorkbenchPageRegistry,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageRegistry,
  type WorkbenchPageRegistryStoreState,
  type WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { WorkbenchShellPlacementRegistry } from "../../registries/placements/shell-placement-registry";
import type { WorkbenchViewMenuRegistry } from "../../registries/view-menus/view-menu-registry";
import { pagePlacementContributionId, registerWorkbenchViewPlacement } from "../../registries/views/view-placement";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";
import { createDisposable } from "../../shared/disposable";

export interface ConnectWorkbenchPageRuntimeInput {
  beforeApply?(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>): void;
  revealRegion?(region: WorkbenchRegion): void;
  layout: LayoutModel;
  modes: WorkbenchModeRegistry;
  registry: WorkbenchPageRegistry<WorkbenchWidgetPlacement>;
}

const syncOwnedPanelMenus = (layout: LayoutModel) => {
  const ownedPlacements = Object.values(layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .filter((placement) => Boolean(placement.placementIdentity));

  for (const placement of ownedPlacements) {
    const owner = layout.getWidget(placement.contributionId);
    for (const menuId of owner?.ownedPanelMenuIds ?? []) {
      const menu = layout.getWidget(menuId);
      if (!menu) continue;
      layout.openWidget(menuId, {
        pinned: true,
        role: "panel-menu",
        viewId: menu.rendererId,
        resource: placement.resource,
        title: menu.region.endsWith("-left-menu") ? placement.resource?.label : menu.title,
      });
    }
  }
  layout.reconcilePanelMenus();
};

const bindPlacementsToActivePageLocation = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
  const pageId = state.activePageId;
  const instanceKey = pageId ? state.pageStates[pageId]?.activePrimaryInstanceKey : undefined;
  if (!pageId || !instanceKey) return state.placements;
  const location = state.placements.find(
    (placement) =>
      placement.identity.kind === "page" &&
      placement.identity.pageId === pageId &&
      placement.identity.instanceKey === instanceKey &&
      placement.value.role === "location",
  );
  const ownerResourceUri = location?.value.resourceUri;
  if (!ownerResourceUri) return state.placements;
  return state.placements.map((placement) =>
    placement.value.role === "sub-panel" && (placement.identity.kind === "page" || Boolean(placement.value.resourceUri))
      ? { ...placement, value: { ...placement.value, ownerResourceUri } }
      : placement,
  );
};

const applyPageState = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  source: "transition" | "scope-restore",
  storeBeforeTransition = input.registry.store.getState(),
) => {
  activateWorkbenchPageMode(input.modes, state.activeModeId, () => {
    // Mode listeners may open or close mode/shell placements after the mode is
    // published. Reconcile the latest registry state so this transition cannot
    // overwrite those declarative changes with the snapshot that began it.
    const stored = input.registry.store.getState();
    const latest = stored === storeBeforeTransition ? state : stored;
    const activation =
      latest.reconciliation.activate.length > 0 ? latest.reconciliation.activate : state.reconciliation.activate;
    const layoutInput = {
      layout: input.layout.getLayout(),
      placements: bindPlacementsToActivePageLocation(latest),
      activate: activation.map((placement) => placement.identity),
    };
    let layout: ReturnType<typeof reconcileOwnedWidgetLayout>;
    if (source === "scope-restore") {
      layout = reconcileOwnedWidgetLayout(layoutInput);
    } else {
      layout = applyOwnedWidgetLayoutReconciliation({
        ...layoutInput,
        remove: latest.reconciliation.remove.map((placement) => placement.identity),
      });
    }
    input.layout.restoreLayout(layout);
    syncOwnedPanelMenus(input.layout);
    if (source === "transition") {
      for (const placement of activation) input.revealRegion?.(placement.region);
    }
  });
};

export const connectWorkbenchPageRuntime = (input: ConnectWorkbenchPageRuntimeInput) => {
  let applyingTransition = false;
  const runtime = getWorkbenchPageRegistryInternals(input.registry).connectRuntime((state) => {
    const storeBeforeTransition = input.registry.store.getState();
    applyingTransition = true;
    try {
      input.beforeApply?.(state);
      applyPageState(input, state, "transition", storeBeforeTransition);
    } finally {
      applyingTransition = false;
    }
  });
  const scope = input.layout.onDidChangePersistenceScope(() => {
    if (!applyingTransition) applyPageState(input, input.registry.store.getState(), "scope-restore");
  });
  return createDisposable(() => {
    scope.dispose();
    runtime.dispose();
  });
};

const parsePageResourceUri = (uri: string) => {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "pstdio:" || parsed.hostname !== "extension-resource") return undefined;
    const [type, id, ...rest] = parsed.pathname.slice(1).split("/");
    if (!type || !id || rest.length > 0) return undefined;
    return { type: decodeURIComponent(type), id: decodeURIComponent(id) };
  } catch {
    return undefined;
  }
};

export const defaultPageResourceCodec: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource }),
  toUri: (resource) =>
    `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`,
  fromUri: parsePageResourceUri,
};

export const toWorkbenchPageResource = (resource: PageResourceRef, codec: WorkbenchPageResourceCodec) => ({
  kind: resource.type,
  uri: codec.toUri(resource),
  id: resource.id,
  label: resource.label,
  metadata: resource.metadata,
});

const toTabState = (open: WorkbenchPagePlacementInput["open"]) => {
  if (!open) return {};
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  return { pinned: false, tabRetention: "preview" as const };
};

const toWidgetPlacement = (
  input: WorkbenchPagePlacementInput,
  resources: WorkbenchPageResourceCodec,
  layout: LayoutModel,
  views: WorkbenchViewRegistry,
): WorkbenchWidgetPlacement => {
  const resource = input.resource ? toWorkbenchPageResource(input.resource, resources) : undefined;
  const view = views.getView(input.viewId);
  if (!view) throw new Error(`Workbench page view is not registered: ${input.viewId}`);
  const panelId = pagePlacementContributionId(input.pageId, input.slotId);
  const panel = layout.getWidget(panelId);
  if (!panel) throw new Error(`Workbench page placement is not registered: ${input.pageId}.${input.slotId}`);
  return {
    ...createPlacement(`workbench.page.${encodeURIComponent(placementIdentityKey(input.identity))}`, panel, {
      viewId: input.viewId,
      title: view.title ?? panel.title,
      role: input.role === "primary" ? "location" : "sub-panel",
      closable: input.closable,
      ...(resource ? { resource } : {}),
      ...toTabState(input.open),
    }),
    ...(input.section ? { section: input.section } : {}),
  };
};

export interface CreateLiveWorkbenchPageRegistryInput {
  beforeApply?(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>): void;
  revealRegion?(region: WorkbenchRegion): void;
  layout: LayoutModel;
  modePlacements: WorkbenchModePlacementRegistry;
  shellPlacements: WorkbenchShellPlacementRegistry;
  modes: WorkbenchModeRegistry;
  resources?: WorkbenchPageResourceCodec;
  views: WorkbenchViewRegistry;
  viewMenus?: WorkbenchViewMenuRegistry;
}

export const createLiveWorkbenchPageRegistry = (input: CreateLiveWorkbenchPageRegistryInput) => {
  const resources = input.resources ?? defaultPageResourceCodec;
  const registry = createWorkbenchPageRegistry<WorkbenchWidgetPlacement>({
    resolveShellPlacements: () => input.shellPlacements.resolvePlacements(),
    resolveModePlacements: (modeId) => input.modePlacements.resolvePlacements(modeId),
    resolvePagePlacement: (placement) => toWidgetPlacement(placement, resources, input.layout, input.views),
    resources,
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    registerPagePlacements: (page) => {
      const registrations = page.slots.map((slot) => {
        const viewId = slot.viewId ?? slot.binding?.viewId;
        if (!viewId) throw new Error(`Workbench page slot view is not registered: ${page.id}.${slot.id}`);
        const closable = slot.role === "auxiliary" && (!slot.viewId || slot.presence !== "fixed");
        return registerWorkbenchViewPlacement(
          input.layout,
          input.views,
          {
            ...slot,
            id: pagePlacementContributionId(page.id, slot.id),
            viewId,
            role: slot.role === "primary" ? "location" : "sub-panel",
            singleton: slot.binding?.cardinality !== "many",
            closable,
          },
          input.viewMenus,
        );
      });
      return createDisposable(() => {
        for (const registration of registrations.reverse()) registration.dispose();
      });
    },
  });
  connectWorkbenchPageRuntime({
    beforeApply: input.beforeApply,
    revealRegion: input.revealRegion,
    layout: input.layout,
    modes: input.modes,
    registry,
  });
  input.modePlacements.onDidChange(() => getWorkbenchPageRegistryInternals(registry).refreshModePlacements());
  input.shellPlacements.onDidChange(() => getWorkbenchPageRegistryInternals(registry).refreshShellPlacements());
  return registry;
};
