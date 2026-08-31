import type { PageOpenIntent, PlacementIdentity, PlacementRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createDisposable, type Disposable } from "../../shared/disposable";
import type { DockedCompositionRegion } from "../layout/composition-resolver-types";
import type { WorkbenchWidgetPlacement } from "../layout/layout-types";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { WorkbenchPageResourceCodec } from "../pages/page-registry";
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

export interface WorkbenchModePanelResolution {
  identity: PlacementIdentity;
  placements: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
}

interface WorkbenchModePanelTarget {
  modeId: string;
  panel: PlacementRef;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  current: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
}

export interface WorkbenchModePlacementRegistry {
  registerPlacement(placement: WorkbenchModePlacementContribution): Disposable;
  listPlacements(modeId?: string): WorkbenchModePlacementContribution[];
  resolvePlacements(
    modeId: string,
    current?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  ): readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[];
  resolvePanelTarget(input: WorkbenchModePanelTarget): WorkbenchModePanelResolution;
  onDidChange(listener: () => void): Disposable;
}

const toWorkbenchResource = (resource: ResourceRef, codec: WorkbenchPageResourceCodec) => ({
  kind: resource.type,
  uri: codec.toUri(resource),
  id: resource.id,
  label: resource.label,
  metadata: resource.metadata,
});

const toTabState = (open: PageOpenIntent | undefined) => {
  if (!open) return {};
  if (open === "pin") return { pinned: true, tabRetention: "persistent" as const };
  return { pinned: false, tabRetention: "preview" as const };
};

const identityFor = (placement: WorkbenchModePlacementContribution, instanceKey: string): PlacementIdentity => ({
  kind: "mode",
  modeId: placement.modeId,
  placementId: placement.id,
  instanceKey,
});

const placementRefKey = (ref: PlacementRef) => JSON.stringify([ref.extensionId, ref.id]);

export const createWorkbenchModePlacementRegistry = (input: {
  resources: WorkbenchPageResourceCodec;
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

  const resolve = (
    placement: WorkbenchModePlacementContribution,
    resource?: ResourceRef,
    open?: PageOpenIntent,
  ): ResolvedOwnedPlacement<WorkbenchWidgetPlacement> => {
    const view = input.views.getView(placement.item.viewId);
    if (!view) throw new Error(`Workbench mode placement view is not registered: ${placement.item.viewId}`);
    const normalizedResource = resource ? input.resources.normalize(resource) : undefined;
    const instanceKey = normalizedResource ? input.resources.toUri(normalizedResource) : "default";
    const identity = identityFor(placement, instanceKey);
    const workbenchResource = normalizedResource ? toWorkbenchResource(normalizedResource, input.resources) : undefined;
    return {
      identity,
      region: placement.region,
      order: placement.order ?? 0,
      value: {
        widgetId: `workbench.mode.${encodeURIComponent(placementIdentityKey(identity))}`,
        contributionId: view.panelId,
        viewId: placement.item.viewId,
        role: placement.region === "main" ? "location" : "sub-panel",
        closable: !placement.required,
        ...(workbenchResource
          ? {
              resource: workbenchResource,
              resourceUri: workbenchResource.uri,
              title: workbenchResource.label,
            }
          : {}),
        ...toTabState(open),
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

  const resolveStaticPanelTarget = (
    placement: WorkbenchModePlacementContribution,
    target: WorkbenchModePanelTarget,
    current: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  ) => {
    if (target.resource) throw new Error(`Mode placement "${placement.id}" does not accept a resource`);
    if (target.open) throw new Error(`Mode placement "${placement.id}" does not accept open intent`);
    const resolved = resolve(placement);
    return {
      identity: resolved.identity,
      placements: [
        ...current.filter(
          (candidate) => candidate.identity.kind !== "mode" || candidate.identity.placementId !== placement.id,
        ),
        resolved,
      ],
    };
  };

  const resolveResourcePanelTarget = (
    placement: WorkbenchModePlacementContribution,
    item: Extract<WorkbenchModePlacementItem, { kind: "resource" }>,
    target: WorkbenchModePanelTarget,
    current: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
  ) => {
    if (!target.resource) throw new Error(`Mode placement "${placement.id}" requires a resource`);
    if (target.resource.type !== item.resourceKind) {
      throw new Error(`Mode placement "${placement.id}" does not accept resource kind "${target.resource.type}"`);
    }
    if (target.open && item.cardinality !== "many") {
      throw new Error(`Mode placement "${placement.id}" accepts open intent only with many cardinality`);
    }
    const normalizedResource = input.resources.normalize(target.resource);
    const instanceKey = input.resources.toUri(normalizedResource);
    if (!instanceKey) throw new Error(`Mode placement "${placement.id}" resolved an empty resource identity`);
    const identity = identityFor(placement, instanceKey);
    const existing = current.find(
      (candidate) =>
        candidate.identity.kind === "mode" &&
        candidate.identity.placementId === placement.id &&
        candidate.identity.instanceKey === instanceKey,
    );
    let open: PageOpenIntent | undefined;
    if (item.cardinality === "many") {
      open = existing?.value.tabRetention === "persistent" || target.open === "pin" ? "pin" : "preview";
    }
    const retained = current.filter((candidate) => {
      if (candidate.identity.kind !== "mode" || candidate.identity.placementId !== placement.id) return true;
      if (candidate.identity.instanceKey === instanceKey) return false;
      return item.cardinality === "many" && (open === "pin" || candidate.value.tabRetention === "persistent");
    });
    return { identity, placements: [...retained, resolve(placement, normalizedResource, open)] };
  };

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

    resolvePanelTarget(target) {
      const placement = refs.get(placementRefKey(target.panel));
      if (!placement) {
        throw new Error(`Workbench mode placement not registered: ${target.panel.extensionId}.${target.panel.id}`);
      }
      if (placement.modeId !== target.modeId) {
        throw new Error(`Mode placement owner is not active: ${placement.modeId}`);
      }
      const current = currentForMode(target.modeId, target.current);
      if (placement.item.kind === "view") {
        return resolveStaticPanelTarget(placement, target, current);
      }
      return resolveResourcePanelTarget(placement, placement.item, target, current);
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
