import type { LayoutModel } from "../../registries/layout/layout-model";
import { getActivePlacement } from "../../registries/layout/layout-operations";
import { getAnchorResource, reconcileAnchors } from "../../registries/layout/surface-reconcile";
import type { ResourceRef, ResourceRegistry } from "../../registries/resources/resource-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";

// Default scope predicate derived from the scoped resource providers. A detached
// resource stays in scope while a provider for its kind still lists it under the active
// primary; kinds with no provider can't be scoped, so they are kept. This makes the
// detached-disconnect behaviour fall out of how providers filter their candidates —
// no per-app wiring needed (apps can still inject a custom predicate).
export const createScopedIsInScope = (resources: ResourceRegistry) => {
  // Reconciliation asks once per detached anchor with the same primary, so materialize the
  // provider view once for that pass. The coordinator only calls again when the primary changes.
  let cached: { primaryUri: string | undefined; kinds: Set<string>; uris: Set<string> } | undefined;

  return (resource: ResourceRef, primary: ResourceRef | undefined) => {
    if (!cached || cached.primaryUri !== primary?.uri) {
      cached = {
        primaryUri: primary?.uri,
        kinds: new Set(resources.listProviders().map((provider) => provider.kind)),
        uris: new Set(resources.listResources("").map((entry) => entry.resource.uri)),
      };
    }

    // Provider-less kinds are intentionally unscoped. Extension companion views rely on
    // this: registering a provider for `extension-view` would make those detached panels
    // participate in disconnect reconciliation and must be paired with an explicit scope policy.
    if (!cached.kinds.has(resource.kind)) return true;
    return cached.uris.has(resource.uri);
  };
};

export interface CreatePrimaryCoordinatorInput {
  layout: LayoutModel;
  // Whether a detached anchor's current resource still belongs to the new primary's
  // scope. Injected (no baked default) so apps decide the disconnect policy; the core
  // default keeps detached anchors (() => true) until scoped providers land.
  isInScope: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
}

// Keeps the secondary resource anchors consistent with the primary (main) resource.
// On a primary change, derived anchors clear (they re-scope to the new primary) and
// detached anchors disconnect once they fall outside the new primary's scope. The
// primary anchor is never mutated, so the selector keyed on the main area's active
// resource cannot re-fire — the reconciliation is feedback-loop safe by construction.
export const createPrimaryCoordinator = ({ layout, isInScope }: CreatePrimaryCoordinatorInput): Disposable => {
  const unsubscribe = layout.store.subscribeSelector(
    (state) => getActivePlacement(state.layout.areas[state.frame.primary])?.resourceUri,
    () => {
      const frame = layout.getFrame();
      const current = layout.getLayout();
      const primary = getAnchorResource(frame, current, "primary");
      for (const action of reconcileAnchors({ frame, layout: current, primary, isInScope })) {
        const resourceScope = layout.getPersistenceScope()?.resource;
        const restoredForPrimary =
          resourceScope !== undefined &&
          (primary === undefined || resourceScope === primary.uri) &&
          frame.secondary?.persistence === "derived" &&
          frame.secondary.slot === action.area &&
          frame.slots[action.area]?.owner === "resource";
        if (restoredForPrimary) continue;
        if (action.action === "clear") layout.clearArea(action.area);
      }
    },
  );

  return createDisposable(unsubscribe);
};
