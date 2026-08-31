import type { PlacementIdentity, PlacementRef } from "@pstdio/sdk/extensions";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { DockedCompositionRegion } from "../layout/composition-resolver-types";
import type { WorkbenchWidgetPlacement } from "../layout/layout-types";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { WorkbenchViewRegistry } from "../views/view-registry";

export type WorkbenchModePlacementItem =
  | { readonly kind: "view"; readonly viewId: string }
  | {
      readonly kind: "resource";
      readonly viewId: string;
      readonly resourceKind: string;
      readonly cardinality: "one" | "many";
    };

export interface WorkbenchModePlacementContribution {
  readonly id: string;
  readonly ref: PlacementRef;
  readonly modeId: string;
  readonly item: WorkbenchModePlacementItem;
  readonly region: DockedCompositionRegion;
  readonly order?: number;
  readonly defaultOpen?: boolean;
  readonly required?: boolean;
  readonly movableTo?: readonly DockedCompositionRegion[];
}

export interface WorkbenchModePlacementRegistry {
  registerPlacement(placement: WorkbenchModePlacementContribution): Disposable;
  listPlacements(modeId?: string): WorkbenchModePlacementContribution[];
  resolvePlacements(
    modeId: string,
    current?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  ): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  onDidChange(listener: () => void): Disposable;
}

const identityFor = (placement: WorkbenchModePlacementContribution, instanceKey: string): PlacementIdentity => ({
  kind: "mode",
  modeId: placement.modeId,
  placementId: placement.id,
  instanceKey,
});

const placementRefKey = (ref: PlacementRef) => JSON.stringify([ref.extensionId, ref.id]);

export const createWorkbenchModePlacementRegistry = (input: {
  views: WorkbenchViewRegistry;
}): WorkbenchModePlacementRegistry => {
  const placements = new Map<string, WorkbenchModePlacementContribution>();
  const refs = new Map<string, WorkbenchModePlacementContribution>();
  const listeners = new Set<() => void>();

  const listPlacements = (modeId?: string) =>
    [...placements.values()]
      .filter((placement) => !modeId || placement.modeId === modeId)
      .sort((left, right) => left.id.localeCompare(right.id));

  const emitChange = () => {
    for (const listener of listeners) listener();
  };

  const resolve = (placement: WorkbenchModePlacementContribution): ResolvedOwnedPlacement<WorkbenchWidgetPlacement> => {
    const view = input.views.getView(placement.item.viewId);
    if (!view) throw new Error(`Workbench mode placement view is not registered: ${placement.item.viewId}`);
    const instanceKey = "default";
    const identity = identityFor(placement, instanceKey);
    return {
      identity,
      region: placement.region,
      order: placement.order ?? 0,
      value: {
        widgetId: `workbench.mode.view.${encodeURIComponent(placement.item.viewId)}`,
        contributionId: view.panelId,
        viewId: placement.item.viewId,
        role: placement.region === "main" ? "location" : "sub-panel",
        closable: !placement.required,
      },
    };
  };

  const currentForMode = (modeId: string, current: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[] = []) =>
    current.filter(
      (candidate) =>
        candidate.identity.kind === "mode" &&
        candidate.identity.modeId === modeId &&
        placements.get(candidate.identity.placementId)?.modeId === modeId,
    );

  return {
    registerPlacement(placement) {
      if (placements.has(placement.id)) throw new Error(`Mode placement already registered: ${placement.id}`);
      if (placement.ref.kind !== "placement" || !placement.ref.extensionId || !placement.ref.id) {
        throw new Error(`Mode placement "${placement.id}" must declare a normalized placement ref`);
      }
      const refKey = placementRefKey(placement.ref);
      if (refs.has(refKey)) throw new Error(`Mode placement ref already registered: ${refKey}`);
      if (placement.required && placement.defaultOpen === false) {
        throw new Error(`Required mode placement "${placement.id}" cannot set defaultOpen to false`);
      }
      if (placement.movableTo && !placement.movableTo.includes(placement.region)) {
        throw new Error(`Mode placement "${placement.id}" must include its initial region in movableTo`);
      }
      if (placement.item.kind === "resource" && placement.required && placement.item.cardinality === "many") {
        throw new Error(`Required mode placement "${placement.id}" cannot have many cardinality`);
      }
      if (!input.views.getView(placement.item.viewId)) {
        throw new Error(`Workbench mode placement view is not registered: ${placement.item.viewId}`);
      }
      const registered = {
        ...placement,
        ref: { ...placement.ref },
        item: { ...placement.item },
        ...(placement.movableTo ? { movableTo: [...placement.movableTo] } : {}),
      };
      placements.set(registered.id, registered);
      refs.set(refKey, registered);
      emitChange();
      return createDisposable(() => {
        if (placements.get(registered.id) !== registered) return;
        placements.delete(registered.id);
        refs.delete(refKey);
        emitChange();
      });
    },

    listPlacements,

    resolvePlacements(modeId, current = []) {
      const retained = currentForMode(modeId, current);
      const retainedKeys = new Set(retained.map((placement) => placementIdentityKey(placement.identity)));
      const defaults = listPlacements(modeId).flatMap((placement) => {
        if (placement.item.kind !== "view" || placement.defaultOpen === false) return [];
        const resolved = resolve(placement);
        return retainedKeys.has(placementIdentityKey(resolved.identity)) ? [] : [resolved];
      });
      return [...retained, ...defaults];
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
