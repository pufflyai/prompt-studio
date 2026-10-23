import type { DockedWorkbenchRegion, PageOpenIntent, PlacementIdentity, PlacementRef } from "@pstdio/sdk/extensions";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { notifyWorkbenchChange } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import { createPlacement } from "../layout/layout-operations";
import type {
  RegisteredWidgetContribution,
  WorkbenchLayout,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "../layout/layout-types";
import type { PlacementDestination, ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import {
  clearOwnedPlacementState,
  closeOwnedPlacementInstance,
  createOwnedPlacementState,
  isStaticPlacementOpen,
  placementItemViewId,
  staticPlacementClosable,
  updateResourcePlacementInstance,
  type WorkbenchOwnedPlacementItem,
} from "../placements/owned-placement-lifecycle";
import type { OwnedPlacementLocationContext } from "../placements/owned-placement-preparation";
import {
  type OwnedPlacementPreparation,
  prepareOwnedPlacement,
  setOwnedPlacementPreparation,
} from "../placements/owned-placement-preparation";
import { restoreOwnedPlacementState } from "../placements/owned-placement-restoration";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchViewMenuRegistry } from "../view-menus/view-menu-registry";
import {
  modePlacementContributionId,
  registerWorkbenchViewPlacement,
  type WorkbenchPlacementPresentation,
} from "../views/view-placement";
import type { WorkbenchViewRegistry } from "../views/view-registry";

import { copyPlacement, placementRefKey, validatePlacement } from "./mode-placement-declarations";

export interface WorkbenchModePlacementContribution extends WorkbenchPlacementPresentation {
  readonly id: string;
  readonly ref: PlacementRef;
  readonly modeId: string;
  readonly item: WorkbenchOwnedPlacementItem;
  readonly region: DockedWorkbenchRegion;
  readonly order?: number;
  readonly movableTo?: readonly DockedWorkbenchRegion[];
}

interface OpenModePlacementTarget {
  panel: PlacementRef;
  /** Explicit destination for this open. Omit to keep an existing tab's placement. */
  region?: DockedWorkbenchRegion;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  relatedSource?: string;
}

export interface WorkbenchModePlacementRegistry {
  registerPlacement(placement: WorkbenchModePlacementContribution): Disposable;
  getPlacement(ref: PlacementRef): WorkbenchModePlacementContribution | undefined;
  listPlacements(modeId?: string): WorkbenchModePlacementContribution[];
  openPlacement(input: OpenModePlacementTarget): PlacementIdentity;
  updatePlacement(
    identity: PlacementIdentity,
    input: { resource?: ResourceRef; title?: string; open?: PageOpenIntent },
  ): void;
  closePlacement(identity: PlacementIdentity): void;
  resolvePlacements(
    modeId: string,
    context?: OwnedPlacementLocationContext,
  ): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  onDidChange(listener: () => void): Disposable;
}

const identityFor = (placement: WorkbenchModePlacementContribution, instanceKey: string): PlacementIdentity => ({
  kind: "mode",
  modeId: placement.modeId,
  placementId: placement.id,
  instanceKey,
});

const tabState = (open: PageOpenIntent | undefined) => {
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  if (open === "preview") return { pinned: false, tabRetention: "preview" as const };
  return {};
};

export const createWorkbenchModePlacementRegistry = (input: {
  views: WorkbenchViewRegistry;
  getProjectId?(): string | undefined;
  loadLayout?(context: OwnedPlacementLocationContext): WorkbenchLayout | undefined;
  viewMenus?: WorkbenchViewMenuRegistry;
  validateOpen?(
    identity: PlacementIdentity,
    region: WorkbenchRegion,
    options: { reveal: boolean; resource?: ResourceRef; requestedRegion?: WorkbenchRegion },
  ): void;
  getPanel(panelId: string): RegisteredWidgetContribution | undefined;
  registerPanel: Parameters<typeof registerWorkbenchViewPlacement>[0];
}): WorkbenchModePlacementRegistry => {
  const placements = new Map<string, WorkbenchModePlacementContribution>();
  const refs = new Map<string, WorkbenchModePlacementContribution>();
  let state = createOwnedPlacementState();
  const listeners = new Set<() => void>();
  const label = "Mode placement";

  const listPlacements = (modeId?: string) =>
    [...placements.values()]
      .filter((placement) => !modeId || placement.modeId === modeId)
      .sort((left, right) => left.id.localeCompare(right.id));

  let runtime: ((destination?: PlacementDestination) => void) | undefined;
  const emitChange = (destination?: PlacementDestination) => {
    runtime?.(destination);
    for (const listener of listeners)
      notifyWorkbenchChange(listener, () => runWorkbenchEffect("mode placement subscriber", listener));
  };

  const resolve = (
    placement: WorkbenchModePlacementContribution,
    instanceKey: string,
    resource?: ResourceRef,
    open?: PageOpenIntent,
    title?: string,
    relatedSource?: string,
  ): ResolvedOwnedPlacement<WorkbenchWidgetPlacement> => {
    const view = input.views.getView(placementItemViewId(placement.item));
    if (!view)
      throw new Error(`Workbench mode placement view is not registered: ${placementItemViewId(placement.item)}`);
    const contributionId = modePlacementContributionId(placement.id);
    const panel = input.getPanel(contributionId);
    if (!panel) throw new Error(`Workbench mode placement is not registered: ${placement.id}`);
    const identity = identityFor(placement, instanceKey);
    return {
      identity,
      region: placement.region,
      order: placement.order ?? 0,
      value: {
        ...createPlacement(
          `workbench.mode.${encodeURIComponent(placement.id)}.${encodeURIComponent(instanceKey)}`,
          panel,
          {
            viewId: placementItemViewId(placement.item),
            role: placement.region === "main" ? "location" : "sub-panel",
            closable: staticPlacementClosable(placement.item),
            ...(resource ? { resource } : {}),
            ...(title ? { title } : {}),
            ...tabState(open),
          },
        ),
        ...(relatedSource ? { relatedSource } : {}),
      },
    };
  };

  const preparation: OwnedPlacementPreparation = {
    connectRuntime(listener) {
      runtime = listener;
      return createDisposable(() => {
        if (runtime === listener) runtime = undefined;
      });
    },
    getState: () => state,
    restore(context, current = state) {
      if (input.getProjectId && context.projectId !== input.getProjectId()) current = createOwnedPlacementState();
      const saved = input.loadLayout?.(context);
      if (!saved) return current;
      const declarations = listPlacements(context.modeId).filter((placement) =>
        placement.item.kind === "view"
          ? !current.staticOverrides.has(placement.id)
          : !current.resourceInstances.has(placement.id),
      );
      if (!declarations.length) return current;
      return restoreOwnedPlacementState({
        state: current,
        declarations,
        saved: Object.values(saved.regions).flatMap((region) => region.widgets),
        owns: (identity) => identity.kind === "mode" && identity.modeId === context.modeId,
      });
    },
    adopt(modeId, saved, current = state) {
      return restoreOwnedPlacementState({
        state: current,
        declarations: listPlacements(modeId),
        saved,
        owns: (identity) => identity.kind === "mode" && identity.modeId === modeId,
      });
    },
    open(target, current = state) {
      const placement = placements.get(target.placementId);
      if (!placement) throw new Error(`Unknown mode placement: ${target.placementId}`);
      if (target.region && placement.movableTo && !placement.movableTo.some((region) => region === target.region))
        throw new Error(`Mode panel cannot open in ${target.region}: ${placement.id}`);
      return prepareOwnedPlacement({
        label,
        target,
        item: placement.item,
        current,
        identityFor: (instanceKey) => identityFor(placement, instanceKey),
      });
    },
    apply: (next) => {
      state = next;
    },
    publish: emitChange,
    resolve(modeId, current = state) {
      if (!modeId) return [];
      return listPlacements(modeId).flatMap((placement) => {
        if (placement.item.kind === "view") {
          return isStaticPlacementOpen(placement.item, current, placement.id) ? [resolve(placement, "default")] : [];
        }
        return (current.resourceInstances.get(placement.id) ?? []).map((instance) =>
          resolve(
            placement,
            instance.instanceKey,
            instance.resource,
            instance.open,
            instance.title,
            instance.relatedSource,
          ),
        );
      });
    },
  };
  const registry: WorkbenchModePlacementRegistry = {
    registerPlacement(placement) {
      const refKey = validatePlacement({ placement, placements, refs, views: input.views });
      const registered = copyPlacement(placement);
      const panel = registerWorkbenchViewPlacement(
        input.registerPanel,
        input.views,
        {
          ...registered,
          id: modePlacementContributionId(registered.id),
          viewId: placementItemViewId(registered.item),
          role: registered.region === "main" ? "location" : "sub-panel",
          singleton: registered.item.kind === "view" || registered.item.binding.cardinality === "one",
          closable: staticPlacementClosable(registered.item),
        },
        input.viewMenus,
      );
      placements.set(registered.id, registered);
      refs.set(refKey, registered);
      // Late bindings need their saved resources; a new static view uses its declared presence.
      if (registered.item.kind === "binding")
        state = preparation.restore!({ modeId: registered.modeId, projectId: input.getProjectId?.() });
      emitChange();
      return createDisposable(() => {
        if (placements.get(registered.id) !== registered) return;
        placements.delete(registered.id);
        refs.delete(refKey);
        clearOwnedPlacementState(state, registered.id);
        panel.dispose();
        emitChange();
      });
    },

    getPlacement(ref) {
      return refs.get(placementRefKey(ref));
    },

    listPlacements,

    openPlacement(target) {
      const placement = refs.get(placementRefKey(target.panel));
      if (!placement) throw new Error(`Unknown mode panel: ${target.panel.extensionId}.${target.panel.id}`);
      const prepared = preparation.open({ ...target, placementId: placement.id });
      input.validateOpen?.(prepared.identity, target.region ?? placement.region, {
        reveal: !target.relatedSource,
        resource: target.resource,
        requestedRegion: target.region,
      });
      preparation.apply(prepared.state);
      preparation.publish(target.region ? { identity: prepared.identity, region: target.region } : undefined);
      return prepared.identity;
    },

    closePlacement(identity) {
      if (identity.kind !== "mode") throw new Error("Mode placement registry closes only mode-owned placements");
      const placement = placements.get(identity.placementId);
      if (!placement) return;
      const changed = closeOwnedPlacementInstance({
        label,
        id: placement.id,
        item: placement.item,
        state,
        instanceKey: identity.instanceKey,
      });
      if (changed) emitChange();
    },

    updatePlacement(identity, update) {
      if (identity.kind !== "mode") throw new Error("Mode placement registry updates only mode-owned placements");
      const placement = placements.get(identity.placementId);
      if (!placement) return;
      updateResourcePlacementInstance({
        label,
        id: placement.id,
        item: placement.item,
        state,
        instanceKey: identity.instanceKey,
        ...update,
      });
      emitChange();
    },

    resolvePlacements: (modeId, context) =>
      preparation.resolve(modeId, context ? preparation.restore!(context) : state),
    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };

  setOwnedPlacementPreparation(registry, preparation);
  return registry;
};
