import { resourceKey } from "@pstdio/sdk/extensions";
import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { getAnchorResource, reconcileAnchors } from "../../registries/layout/surface-reconcile";
import type { ResourceRef, ResourceRegistry } from "../../registries/resources/resource-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
// Default scope predicate derived from the scoped resource providers. A detached
// resource stays in scope while a provider for its kind still lists it under the active
// primary; kinds with no provider can't be scoped, so they are kept. This makes the
// detached-disconnect behaviour fall out of how providers filter their candidates —
// no per-app wiring needed (apps can still inject a custom predicate).
//
// It deliberately ignores the `primary` argument the coordinator passes: scoping is read
// from the registry's own `getPrimary` closure (which already reflects the live primary),
// so the candidate list and this predicate cannot drift to different primaries.
export const createScopedIsInScope = (resources: ResourceRegistry) => (resource: ResourceRef) => {
  const hasProvider = resources.listProviders().some((provider) => provider.kind === resource.type);
  if (!hasProvider) return true;
  return resources.listResources("").some((entry) => resourceKey(entry.resource) === resourceKey(resource));
};
export interface CreatePrimaryCoordinatorInput {
  layout: LayoutModel;
  primary?: {
    getResource(): ResourceRef | undefined;
    subscribe(listener: () => void): Disposable;
  };
  // Whether a detached anchor's current resource still belongs to the new primary's
  // scope. Injected (no baked default) so apps decide the disconnect policy; the core
  // default keeps detached anchors (() => true) until scoped providers land.
  isInScope: (resource: ResourceRef, primary: ResourceRef | undefined) => boolean;
}
// Keeps the secondary resource anchors consistent with the primary (main) resource.
// On a primary change, derived anchors clear (they re-scope to the new primary) and
// detached anchors disconnect once they fall outside the new primary's scope. The
// primary anchor is never mutated, so the selector keyed on the main region's active
// resource cannot re-fire — the reconciliation is feedback-loop safe by construction.
export const createPrimaryCoordinator = ({
  layout,
  isInScope,
  primary: source,
}: CreatePrimaryCoordinatorInput): Disposable => {
  let changingPersistenceScope = false;
  const getPrimary = () => (source ? source.getResource() : getAnchorResource(layout.getLayout(), "primary"));
  let previousPrimaryKey = resourceKey(getPrimary());
  const willChangeScope = layout.onWillChangePersistenceScope(() => {
    changingPersistenceScope = true;
  });
  const didChangeScope = layout.onDidChangePersistenceScope(() => {
    changingPersistenceScope = false;
  });
  const reconcile = (previousLayout: WorkbenchLayout) => {
    const primary = getPrimary();
    const changed = resourceKey(primary) !== previousPrimaryKey;
    previousPrimaryKey = resourceKey(primary);
    if (!changed || changingPersistenceScope) return;
    // Reconcile only placements that belonged to the Location that is leaving.
    // Another listener may synchronously populate the new Location before this
    // callback runs; clearing the live region would delete that new content too.
    for (const action of reconcileAnchors({ layout: previousLayout, primary, isInScope })) {
      if (action.action !== "clear") continue;
      layout.removeWidgetPlacement(action.widgetId);
    }
  };
  const unsubscribe = layout.store.subscribe((_state, previous) => reconcile(previous.layout));
  const primarySubscription = source?.subscribe(() => reconcile(layout.getLayout()));
  return createDisposable(() => {
    unsubscribe();
    primarySubscription?.dispose();
    willChangeScope.dispose();
    didChangeScope.dispose();
  });
};
