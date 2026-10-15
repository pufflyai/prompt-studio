import { reconcileOwnedWidgetLayout } from "../../registries/layout/owned-placement-layout";
import { isPageRegion } from "../../registries/layout/owner-region-state";
import { defaultPageLayout } from "../../registries/layout/panel-geometry";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { emptyPageState } from "../../registries/pages/page-slot-lifecycle";
import { pageStateKey } from "../../registries/pages/page-state-key";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import { createDisposable } from "../../shared/disposable";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { WorkbenchCore } from "../../workbench-core-types";
import { saveOpenOwnerLayouts } from "../page-runtime/open-owner-layouts";
import { resetMissingPresets } from "./reset-missing-presets";
import { resetOwnedPlacements } from "./reset-owned-placements";
import { closedResetPresets, resetOwnerScope, restorePresetBindings } from "./reset-preset-bindings";

export type LayoutResetOwner = "page" | "mode";

const resetGeometry = (core: WorkbenchCore, owner: LayoutResetOwner) => {
  const layout = core.layout.getLayout();
  const defaults = core.layout.store.getInitialState().layout;
  const modeContribution = core.modes.getMode(core.modes.getActiveModeId() ?? "");
  const page = core.pages.getPage(core.pages.store.getState().activePageId ?? "");
  return {
    ...layout,
    ...(owner === "page"
      ? { pageLayout: defaultPageLayout(page?.regionSettings?.aside?.edge, page?.regionSettings?.bottom?.edge) }
      : { modeLayout: modeContribution?.layout, actionBarEdge: modeContribution?.actionBarEdge }),
    regions: Object.fromEntries(
      Object.entries(layout.regions).map(([id, region]) => [
        id,
        isPageRegion(region.id) === (owner === "page")
          ? {
              ...region,
              size: undefined,
              visibility: undefined,
              headerVisible: undefined,
              bubblePosition: undefined,
              visible: defaults.regions[region.id].visible,
              presentation: defaults.regions[region.id].presentation,
            }
          : region,
      ]),
    ) as typeof layout.regions,
  };
};

const resetLayout = (core: WorkbenchCore, owner: LayoutResetOwner) => {
  const current = core.pages.store.getState();
  const activeModeId = current.activeModeId ?? core.modes.getActiveModeId();
  const page = current.activePageId ? current.pages[current.activePageId] : undefined;
  if (owner === "page" && (!page || !current.projectId || !current.location)) return;
  const mode = getOwnedPlacementPreparation(core.modePlacements);
  const modeState = {
    staticOverrides: new Map(mode.getState().staticOverrides),
    resourceInstances: new Map(mode.getState().resourceInstances),
  };
  if (owner === "mode") {
    for (const declaration of core.modePlacements.listPlacements(activeModeId))
      modeState.staticOverrides.delete(declaration.id);
  }
  const internals = getWorkbenchPageRegistryInternals(core.pages);
  const key = page && current.location ? pageStateKey(page, current.location, internals.resources) : undefined;
  const closed = closedResetPresets(core, owner);
  const pageState = restorePresetBindings(
    core,
    closed,
    owner === "page" && page
      ? {
          ...current.pageStates[key!],
          ...emptyPageState(page),
          resourceInstances: current.pageStates[key!]?.resourceInstances ?? {},
        }
      : (current.pageStates[key!] ?? { openStaticSlotIds: [], resourceInstances: {} }),
    modeState,
  );
  const next =
    page && current.projectId && current.location
      ? internals.prepare.location(
          {
            pageId: page.id,
            projectId: current.projectId,
            location: current.location,
            resource: current.location.resource,
            action: `reset${owner}Layout`,
            pageStates: key
              ? {
                  ...current.pageStates,
                  [key]: pageState,
                }
              : current.pageStates,
          },
          current,
          { mode: mode.resolve(activeModeId, modeState), shell: core.shellPlacements.resolvePlacements() },
        )
      : undefined;
  const layout = core.layout.getLayout();
  const placements = resetOwnedPlacements(
    core,
    (next?.placements ?? mode.resolve(activeModeId, modeState)).filter((p) =>
      owner === "page" ? p.identity.kind === "page" : p.identity.kind === "mode",
    ),
  ).map((p) => {
    const previous = closed.find(
      (tab) =>
        tab.placementIdentity &&
        placementIdentityKey(tab.placementIdentity) === placementIdentityKey(p.identity) &&
        tab.resourceKey === p.value.resourceKey,
    );
    return previous ? { ...p, value: { ...p.value, widgetId: previous.widgetId } } : p;
  });
  const cleared = resetGeometry(core, owner);
  batchWorkbenchChanges(() => {
    core.panelMenuState.reset(
      Object.values(layout.regions)
        .filter((r) => isPageRegion(r.id) === (owner === "page"))
        .flatMap((r) => [
          r.id,
          ...r.widgets.filter((t) => t.role === "panel-menu").map((t) => `panel-menu:${t.widgetId}`),
        ]),
    );
    mode.apply(modeState);
    core.layout.restoreLayout(reconcileOwnedWidgetLayout({ layout: cleared, placements }));
    saveOpenOwnerLayouts(core);
    if (next) internals.publish(next, `reset${owner}Layout`);
  });
};

export const createLayoutResetController = (resolve: () => WorkbenchCore) => {
  const listeners = new Set<(owner: LayoutResetOwner) => void>();
  const pending = new Map<string, Promise<void>>();
  const reset = (owner: LayoutResetOwner) => {
    const core = resolve();
    const key = JSON.stringify([owner, resetOwnerScope(core, owner)]);
    const previous = pending.get(key);
    if (previous) return previous;
    let complete!: () => void;
    let fail!: (error: unknown) => void;
    const completion = new Promise<void>((resolve, reject) => {
      complete = resolve;
      fail = reject;
    });
    pending.set(key, completion);
    const run = async () => {
      try {
        resetLayout(core, owner);
        for (const listener of listeners) listener(owner);
        await resetMissingPresets(core, owner);
        complete();
      } catch (error) {
        fail(error);
      } finally {
        pending.delete(key);
      }
    };
    void run();
    return completion;
  };
  return {
    resetPageLayout: () => reset("page"),
    resetModeLayout: () => reset("mode"),
    onDidResetLayout(listener: (owner: LayoutResetOwner) => void) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
