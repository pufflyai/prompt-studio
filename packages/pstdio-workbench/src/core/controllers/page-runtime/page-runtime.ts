import { contributionRefId, type PlacementIdentity, resourceKey } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import type { LayoutModel, WorkbenchRegion } from "../../registries/layout/layout-model";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import {
  applyOwnedWidgetLayoutReconciliation,
  reconcileOwnedWidgetLayout,
} from "../../registries/layout/owned-placement-layout";
import { clampPanelSizes } from "../../registries/layout/panel-size-policy";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { applyModePanelPolicy } from "../../registries/modes/mode-layout";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import { activateWorkbenchPageMode } from "../../registries/modes/mode-registry-internals";
import { isSingleViewPage, pageSlots } from "../../registries/pages/page-main";
import {
  type CreateWorkbenchPageRegistryInput,
  createWorkbenchPageRegistry,
  type WorkbenchPageRegistry,
  type WorkbenchPageRegistryStoreState,
  type WorkbenchPageResourceCodec,
} from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createOwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchShellPlacementRegistry } from "../../registries/placements/shell-placement-registry";
import type { WorkbenchViewMenuRegistry } from "../../registries/view-menus/view-menu-registry";
import { pagePlacementContributionId, registerWorkbenchViewPlacement } from "../../registries/views/view-placement";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";
import { createDisposable } from "../../shared/disposable";
import { restoreModePanelLayout } from "./mode-panel-layout";
import { preparePageContentTrays } from "./page-content-layout";
import { validatePageLandingDeclaration } from "./page-landing-declaration";
import { belongsToActivePageContext, pageContextChanged } from "./page-main-tabs";
import { preparePageLanding, validatePagePanelView } from "./page-panel-view";
import { departingPagePreviews } from "./page-preview-lifetime";
import { normalizePageRuntimeState } from "./page-runtime-normalization";
import { toWidgetPlacement } from "./page-view-instance";
import { selectedMainLayout } from "./selected-main-layout";
import { connectTrayPreviewRemoval } from "./tray-preview-removal";
export interface ConnectWorkbenchPageRuntimeInput {
  isResourceViewer?(identity: PlacementIdentity): boolean;
  loadPageLayout?(state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>): WorkbenchLayout | undefined;
  loadModeLayout?(projectId: string | undefined, modeId: string): WorkbenchLayout | undefined;
  saveModeLayout?(projectId: string | undefined, modeId: string, layout: WorkbenchLayout): void;
  savePageMain?(
    state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
    layout: WorkbenchLayout,
    beforePreviewRemoval?: WorkbenchLayout,
  ): void;
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
  const ownerResourceKey = resourceKey(state.location?.resource);
  if (!ownerResourceKey) return state.placements;
  // Tabs a shared tray retained from other pages or resources do not close with this Location.
  return state.placements.map((placement) =>
    placement.value.role === "sub-panel" &&
    belongsToActivePageContext({ ...placement.value, placementIdentity: placement.identity }, state)
      ? { ...placement, value: { ...placement.value, ownerResourceKey } }
      : placement,
  );
};
const isModeReturn = (
  previous: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  next: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  modeChanged: boolean,
  saved: WorkbenchLayout | undefined,
) => Boolean(previous.activeModeId && previous.projectId === next.projectId && modeChanged && saved);
const reconcilePageLayout = (
  input: Parameters<typeof reconcileOwnedWidgetLayout>[0],
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  restoredScope: boolean,
) => {
  // A restored cache needs the complete owned set; a delta belongs to the previous scope.
  if (restoredScope) return reconcileOwnedWidgetLayout(input);
  return applyOwnedWidgetLayoutReconciliation({
    ...input,
    remove: state.reconciliation.remove.map((placement) => placement.identity),
  });
};
const pageActivations = (
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  latest: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  restoresMode: boolean,
) => {
  if (restoresMode) return [];
  return latest.reconciliation.activate.length > 0 ? latest.reconciliation.activate : state.reconciliation.activate;
};
const revealPagePlacements = (
  input: ConnectWorkbenchPageRuntimeInput,
  layout: WorkbenchLayout,
  placements: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>["reconciliation"]["activate"],
) => {
  for (const placement of placements) {
    const key = placementIdentityKey(placement.identity);
    const region = Object.values(layout.regions).find((region) =>
      region.widgets.some(
        (widget) => widget.placementIdentity && placementIdentityKey(widget.placementIdentity) === key,
      ),
    );
    if (region) input.revealRegion?.(region.id);
  }
};
const applyPageState = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  source: "transition" | "scope-restore" | "selection",
  storeBeforeTransition = input.registry.store.getState(),
) => {
  const previousScope = input.layout.getPersistenceScope();
  const previous = input.registry.store.getState();
  // Before the first page, the user may already have changed the current
  // project's panel chrome. Those choices initialize its first mode.
  const defaultLayout = !previous.activeModeId ? input.layout.getLayout() : input.layout.store.getInitialState().layout;
  const modeChanged = previous.activeModeId !== state.activeModeId || previous.projectId !== state.projectId;
  const modeLayout = state.activeModeId ? input.loadModeLayout?.(state.projectId, state.activeModeId) : undefined;
  const destination = input.loadPageLayout?.(state);
  const pageLayout = source === "selection" ? selectedMainLayout(input.layout.getLayout(), destination) : destination;
  const restoresMode = isModeReturn(previous, state, modeChanged, modeLayout);
  if (source !== "scope-restore") {
    const beforePreviewRemoval = input.layout.getLayout();
    if (modeChanged && previous.activeModeId)
      input.saveModeLayout?.(previous.projectId, previous.activeModeId, input.layout.getLayout());
    if (source !== "selection")
      for (const preview of departingPagePreviews(state, previous, input.layout.getLayout()))
        input.layout.removeWidgetPlacement(preview.widgetId);
    if (pageContextChanged(state, previous))
      input.savePageMain?.(previous, input.layout.getLayout(), beforePreviewRemoval);
  }
  activateWorkbenchPageMode(input.modes, state.activeModeId, () => {
    // Scope listeners must apply the destination mode's panel policy to its saved layout.
    if (source !== "scope-restore") input.beforeApply?.(state);
    // Mode listeners may open or close mode/shell placements after the mode is
    // published. Reconcile the latest registry state so this transition cannot
    // overwrite those declarative changes with the snapshot that began it.
    const stored = input.registry.store.getState();
    const latest = stored === storeBeforeTransition ? state : stored;
    const restoredScope = source === "scope-restore" || input.layout.getPersistenceScope() !== previousScope;
    const restoresLayout = modeChanged || restoredScope || pageContextChanged(state, previous);
    const activation = pageActivations(state, latest, restoresMode);
    const pageContent = isSingleViewPage(latest.pages[latest.activePageId ?? ""]);
    const restored = restoresLayout
      ? restoreModePanelLayout(input.layout.getLayout(), modeLayout, defaultLayout, pageLayout)
      : input.layout.getLayout();
    const layoutInput = {
      layout: restored,
      modeLayout,
      placements: bindPlacementsToActivePageLocation(latest),
      activate: activation.map((placement) => placement.identity),
      destinations: source !== "scope-restore" ? latest.reconciliation.destinations : undefined,
    };
    const layout = reconcilePageLayout(
      pageContent ? preparePageContentTrays(layoutInput) : layoutInput,
      latest,
      restoresLayout,
    );
    const mode = latest.activeModeId ? input.modes.getMode(latest.activeModeId) : undefined;
    const availableLayout = applyModePanelPolicy(layout, mode, (region) =>
      input.layout.getRegionSettings(region, mode?.id),
    );
    input.layout.restoreLayout(clampPanelSizes(availableLayout, input.layout.getRegionSize));
    syncOwnedPanelMenus(input.layout);
    if (source !== "scope-restore") revealPagePlacements(input, layout, activation);
  });
  return restoresMode ? ("restore-mode" as const) : ("open-page" as const);
};
export const connectWorkbenchPageRuntime = (input: ConnectWorkbenchPageRuntimeInput) => {
  let applyingTransition = false;
  const runtime = getWorkbenchPageRegistryInternals(input.registry).connectRuntime(
    (state, operation) => {
      const storeBeforeTransition = input.registry.store.getState();
      applyingTransition = true;
      try {
        return applyPageState(input, state, operation === "select" ? "selection" : "transition", storeBeforeTransition);
      } finally {
        applyingTransition = false;
      }
    },
    (state, operation) => normalizePageRuntimeState(input, state, operation),
  );
  const removedPreviews = connectTrayPreviewRemoval(input, () => applyingTransition);
  const scope = input.layout.onDidChangePersistenceScope(() => {
    const state = input.registry.store.getState();
    if (!applyingTransition && state.activePageId) applyPageState(input, state, "scope-restore");
  });
  return createDisposable(() => {
    scope.dispose();
    removedPreviews();
    runtime.dispose();
  });
};
export interface CreateLiveWorkbenchPageRegistryInput {
  isResourceViewer?: ConnectWorkbenchPageRuntimeInput["isResourceViewer"];
  loadPageLayout?: ConnectWorkbenchPageRuntimeInput["loadPageLayout"];
  loadModeLayout?: ConnectWorkbenchPageRuntimeInput["loadModeLayout"];
  saveModeLayout?: ConnectWorkbenchPageRuntimeInput["saveModeLayout"];
  savePageMain?: ConnectWorkbenchPageRuntimeInput["savePageMain"];
  restorePageState?: CreateWorkbenchPageRegistryInput<WorkbenchWidgetPlacement>["restorePageState"];
  validateLanding?: CreateWorkbenchPageRegistryInput<WorkbenchWidgetPlacement>["validateLanding"];
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
    validateLanding: input.validateLanding,
    restorePageState: input.restorePageState,
    validateMode: (modeId) => {
      if (!input.modes.getMode(modeId)) throw new Error(`Workbench mode not registered: ${modeId}`);
    },
    resolveShellPlacements: (context) => input.shellPlacements.resolvePlacements(context),
    resolveModePlacements: (modeId, location, projectId, pageId) =>
      input.modePlacements.resolvePlacements(modeId, projectId ? { modeId, location, projectId, pageId } : undefined),
    resolveLanding: (page, context) => {
      const mode = getOwnedPlacementPreparation(input.modePlacements);
      const state = mode.restore!({ ...context, modeId: page.modeId, pageId: page.id });
      const prepared = preparePageLanding(page, input.modePlacements, state, context);
      if (!prepared) return undefined;
      return { placements: mode.resolve(page.modeId, prepared.state), identity: prepared.identity };
    },
    resolvePagePlacement: (placement) => toWidgetPlacement(placement, input.layout, input.views),
    resources,
    valuesEqual: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    registerPagePlacements: (page) => {
      validatePagePanelView(page, input.modePlacements);
      validatePageLandingDeclaration(page, input.modePlacements, registry.listPages());
      const registrations = pageSlots(page).map((slot) => {
        const viewId = contributionRefId(slot.item.kind === "view" ? slot.item.view : slot.item.binding.view);
        if (!viewId) throw new Error(`Workbench page slot view is not registered: ${page.id}.${slot.id}`);
        return registerWorkbenchViewPlacement(
          input.layout,
          input.views,
          {
            ...slot,
            id: pagePlacementContributionId(page.id, slot.id),
            viewId,
            role: slot.role === "primary" ? "location" : "sub-panel",
            singleton: slot.item.kind === "view" || slot.item.binding.cardinality !== "many",
            closable: !(slot.role === "primary" && page.main.kind === "view" && page.main.presentation === "page"),
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
    isResourceViewer: input.isResourceViewer,
    loadPageLayout: input.loadPageLayout,
    loadModeLayout: input.loadModeLayout,
    saveModeLayout: input.saveModeLayout,
    savePageMain: input.savePageMain,
    beforeApply: (state) => {
      input.beforeApply?.(state);
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
    },
    revealRegion: input.revealRegion,
    layout: input.layout,
    modes: input.modes,
    registry,
  });
  getOwnedPlacementPreparation(input.modePlacements).connectRuntime((destination) =>
    getWorkbenchPageRegistryInternals(registry).refreshModePlacements(destination),
  );
  getOwnedPlacementPreparation(input.shellPlacements).connectRuntime((destination) =>
    getWorkbenchPageRegistryInternals(registry).refreshShellPlacements(destination),
  );
  return registry;
};
