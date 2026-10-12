import {
  contributionRefId,
  defaultPageResourceCodec,
  type PlacementIdentity,
  resourceKey,
} from "@pstdio/sdk/extensions";
import type { LayoutModel, WorkbenchRegion } from "../../registries/layout/layout-model";
import { createPlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import {
  applyOwnedWidgetLayoutReconciliation,
  reconcileOwnedWidgetLayout,
} from "../../registries/layout/owned-placement-layout";
import { restoreAdoptedModeGeometry, restorePageGeometry } from "../../registries/layout/owner-region-state";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import { applyModePanelAvailability, panelsForMode } from "../../registries/modes/mode-layout";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import { activateWorkbenchPageMode } from "../../registries/modes/mode-registry-internals";
import { isPageSlotClosable, pagePlacementDeclarations } from "../../registries/pages/page-main";
import { registerPagePanelMenus } from "../../registries/pages/page-panel-menus";
import {
  type CreateWorkbenchPageRegistryInput,
  createWorkbenchPageRegistry,
  type WorkbenchPagePlacementInput,
  type WorkbenchPageRegistry,
  type WorkbenchPageRegistryStoreState,
  type WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createOwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { hasPlacementDeclaration } from "../../registries/placements/placement-declaration";
import type { WorkbenchShellPlacementRegistry } from "../../registries/placements/shell-placement-registry";
import type { WorkbenchViewMenuRegistry } from "../../registries/view-menus/view-menu-registry";
import { pagePlacementContributionId, registerWorkbenchViewPlacement } from "../../registries/views/view-placement";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";
import { createDisposable } from "../../shared/disposable";
import { ownerLayoutActivation, resolveOwnerPlacements } from "./owner-layout-resolution";
import { reuseSingleMainView } from "./reuse-single-main-view";
export interface ConnectWorkbenchPageRuntimeInput {
  hasDeclaration?(identity: PlacementIdentity): boolean;
  loadPageLayout?(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>): WorkbenchLayout | undefined;
  loadPageGeometry?(projectId: string, pageId: string): WorkbenchLayout | undefined;
  loadModeLayout?(projectId: string | undefined, modeId: string): WorkbenchLayout | undefined;
  beforeApply?(
    state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  ): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[] | undefined;
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
  const ownerResourceKey = resourceKey(state.location?.resource);
  if (!ownerResourceKey) return state.placements;
  return state.placements.map((placement) =>
    placement.value.role === "sub-panel" && (placement.identity.kind === "page" || Boolean(placement.value.resourceKey))
      ? { ...placement, value: { ...placement.value, ownerResourceKey } }
      : placement,
  );
};
const prepareRuntimeLayout = (
  input: ConnectWorkbenchPageRuntimeInput,
  latest: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  activation: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>["placements"],
  enteringPage: boolean,
  adoptedModePlacements?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
) => {
  const modeLayout = latest.activeModeId ? input.loadModeLayout?.(latest.projectId, latest.activeModeId) : undefined;
  const ownerManaged = Boolean(input.loadPageLayout && latest.activePageId);
  const placements =
    ownerManaged && input.loadPageLayout
      ? resolveOwnerPlacements({
          state: latest,
          pageLayout:
            enteringPage && !input.layout.enteredWithPersistedLayout() ? undefined : input.loadPageLayout(latest),
          modeLayout,
          enteringPage,
          currentLayout: input.layout.getLayout(),
          adoptedModePlacements,
          getWidget: input.layout.getWidget,
          hasDeclaration: input.hasDeclaration,
        })
      : bindPlacementsToActivePageLocation(latest);
  return {
    ownerManaged,
    layout: input.layout.getLayout(),
    modeLayout,
    placements,
    activate: ownerLayoutActivation(activation, placements).map((p) => p.identity),
  };
};

const restoreRuntimeGeometry = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  layout: WorkbenchLayout,
) => {
  const geometry =
    state.projectId && state.activePageId ? input.loadPageGeometry?.(state.projectId, state.activePageId) : undefined;
  return restorePageGeometry(layout, geometry);
};

const applyPageState = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  source: "transition" | "scope-restore",
  storeBeforeTransition = input.registry.store.getState(),
) => {
  const previousLayout = input.layout.getLayout();
  const previousScope = input.layout.getPersistenceScope();
  activateWorkbenchPageMode(input.modes, state.activeModeId, () => {
    // Scope listeners must apply the destination mode's panel policy to its saved layout.
    const adopted = source === "transition" ? input.beforeApply?.(state) : undefined;
    // Mode listeners may open or close mode/shell placements after the mode is
    // published. Reconcile the latest registry state so this transition cannot
    // overwrite those declarative changes with the snapshot that began it.
    const stored = input.registry.store.getState();
    const latest = stored === storeBeforeTransition ? state : stored;
    const activation =
      latest.reconciliation.activate.length > 0 ? latest.reconciliation.activate : state.reconciliation.activate;
    const enteringPage = input.layout.getPersistenceScope() !== previousScope;
    const { ownerManaged, ...layoutInput } = prepareRuntimeLayout(input, latest, activation, enteringPage, adopted);
    let layout: ReturnType<typeof reconcileOwnedWidgetLayout>;
    // A restored cache needs the complete owned set; a delta belongs to the previous scope.
    if (ownerManaged || source === "scope-restore" || enteringPage) {
      layout = reconcileOwnedWidgetLayout(layoutInput);
    } else {
      layout = applyOwnedWidgetLayoutReconciliation({
        ...layoutInput,
        remove: latest.reconciliation.remove.map((placement) => placement.identity),
      });
    }
    const activated = ownerLayoutActivation(activation, layoutInput.placements);
    const restored = restoreAdoptedModeGeometry(
      restoreRuntimeGeometry(input, latest, layout),
      previousLayout,
      adopted?.map((placement) => placement.region) ?? [],
      activated.map((placement) => placement.region),
    );
    const mode = latest.activeModeId ? input.modes.getMode(latest.activeModeId) : undefined;
    const available = mode ? applyModePanelAvailability(restored, panelsForMode(mode)) : restored;
    input.layout.restoreLayout(
      storeBeforeTransition.projectId === latest.projectId
        ? reuseSingleMainView(previousLayout, available, latest.pages)
        : available,
    );
    syncOwnedPanelMenus(input.layout);
    if (source === "transition") {
      for (const placement of activated) input.revealRegion?.(placement.region);
    }
  });
};
export const connectWorkbenchPageRuntime = (input: ConnectWorkbenchPageRuntimeInput) => {
  let applyingTransition = false;
  const runtime = getWorkbenchPageRegistryInternals(input.registry).connectRuntime((state) => {
    const storeBeforeTransition = input.registry.store.getState();
    applyingTransition = true;
    try {
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
const toTabState = (open: WorkbenchPagePlacementInput["open"]) => {
  if (!open) return {};
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  return { pinned: false, tabRetention: "preview" as const };
};
const placementRole = (role: WorkbenchPagePlacementInput["role"]) => {
  if (role === "panel-menu") return "panel-menu";
  return role === "primary" ? "location" : "sub-panel";
};
const toWidgetPlacement = (
  input: WorkbenchPagePlacementInput,
  layout: LayoutModel,
  views: WorkbenchViewRegistry,
): WorkbenchWidgetPlacement => {
  const resource = input.resource;
  const view = views.getView(input.viewId);
  if (!view) throw new Error(`Workbench page view is not registered: ${input.viewId}`);
  const panelId = pagePlacementContributionId(input.pageId, input.slotId);
  const panel = layout.getWidget(panelId);
  if (!panel) throw new Error(`Workbench page placement is not registered: ${input.pageId}.${input.slotId}`);
  return {
    ...createPlacement(
      `workbench.page.${encodeURIComponent(input.ownerInstanceKey ?? "")}.${encodeURIComponent(placementIdentityKey(input.identity))}`,
      panel,
      {
        viewId: input.viewId,
        title: resource?.label ?? view.title ?? panel.title,
        role: placementRole(input.role),
        closable: input.closable,
        ...(resource ? { resource } : {}),
        ...toTabState(input.open),
      },
    ),
    ...(input.section ? { section: input.section } : {}),
  };
};
export interface CreateLiveWorkbenchPageRegistryInput {
  loadModeLayout?: ConnectWorkbenchPageRuntimeInput["loadModeLayout"];
  loadPageLayout?: ConnectWorkbenchPageRuntimeInput["loadPageLayout"];
  loadPageGeometry?: ConnectWorkbenchPageRuntimeInput["loadPageGeometry"];
  restorePageState?: CreateWorkbenchPageRegistryInput<WorkbenchWidgetPlacement>["restorePageState"];
  beforeApply?: ConnectWorkbenchPageRuntimeInput["beforeApply"];
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
    restorePageState: input.restorePageState,
    validateMode: (modeId) => {
      if (!input.modes.getMode(modeId)) throw new Error(`Workbench mode not registered: ${modeId}`);
    },
    resolveShellPlacements: (context) => input.shellPlacements.resolvePlacements(context),
    resolveModePlacements: (modeId, location, projectId, pageId) =>
      input.modePlacements.resolvePlacements(modeId, projectId ? { modeId, location, projectId, pageId } : undefined),
    resolvePagePlacement: (placement) => toWidgetPlacement(placement, input.layout, input.views),
    resources,
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    registerPagePlacements: (page) => {
      const registrations = pagePlacementDeclarations(page).map((slot) => {
        const viewId = contributionRefId(slot.item.kind === "view" ? slot.item.view : slot.item.binding.view);
        if (!viewId) throw new Error(`Workbench page slot view is not registered: ${page.id}.${slot.id}`);
        const closable = isPageSlotClosable(slot);
        return registerWorkbenchViewPlacement(
          input.layout,
          input.views,
          {
            ...slot,
            id: pagePlacementContributionId(page.id, slot.id),
            viewId,
            role: slot.role === "primary" ? "location" : "sub-panel",
            singleton: slot.item.kind === "view" || slot.item.binding.cardinality !== "many",
            closable,
          },
          input.viewMenus,
        );
      });
      registrations.push(...registerPagePanelMenus(page, input.layout, input.views));
      return createDisposable(() => {
        for (const registration of registrations.reverse()) registration.dispose();
      });
    },
  });
  connectWorkbenchPageRuntime({
    hasDeclaration: (identity) =>
      hasPlacementDeclaration(
        { pages: registry, modePlacements: input.modePlacements, shellPlacements: input.shellPlacements },
        identity,
      ),
    loadModeLayout: input.loadModeLayout,
    loadPageLayout: input.loadPageLayout,
    loadPageGeometry: input.loadPageGeometry,
    beforeApply: (state) => {
      const adopted = input.beforeApply?.(state);
      const shell = getOwnedPlacementPreparation(input.shellPlacements);
      shell.apply(
        shell.adopt!(
          state.activeModeId ?? "",
          state.placements.map((placement) => ({ ...placement.value, placementIdentity: placement.identity })),
        ),
      );
      const mode = getOwnedPlacementPreparation(input.modePlacements);
      if (state.projectId !== registry.store.getState().projectId) mode.apply(createOwnedPlacementState());
      if (state.activeModeId)
        mode.apply(
          mode.adopt!(
            state.activeModeId,
            state.placements.map((placement) => ({ ...placement.value, placementIdentity: placement.identity })),
          ),
        );
      return adopted;
    },
    revealRegion: input.revealRegion,
    layout: input.layout,
    modes: input.modes,
    registry,
  });
  getOwnedPlacementPreparation(input.modePlacements).connectRuntime(() =>
    getWorkbenchPageRegistryInternals(registry).refreshModePlacements(),
  );
  getOwnedPlacementPreparation(input.shellPlacements).connectRuntime(() =>
    getWorkbenchPageRegistryInternals(registry).refreshShellPlacements(),
  );
  return registry;
};
