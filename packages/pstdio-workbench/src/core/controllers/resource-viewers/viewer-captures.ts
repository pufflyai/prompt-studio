import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { observeWorkbenchStoreTransitions } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core-types";

interface CaptureLease {
  identity: PlacementIdentity;
  projectId?: string;
  resourceKey?: string;
  current: boolean;
}

export const createViewerCaptures = (
  resolveCore: () => WorkbenchCore,
  resolveSource: (core: WorkbenchCore, identity: PlacementIdentity) => { resource?: ResourceRef } | undefined,
) => {
  const leases = new Map<string, CaptureLease>();
  const subscriptions: (() => void)[] = [];
  const reconcile = () => {
    const core = resolveCore();
    for (const [key, lease] of leases) {
      const source = resolveSource(core, lease.identity);
      const resourceKey = source?.resource ? core.pages.resourceReferenceKey(source.resource) : undefined;
      if (source && lease.projectId === core.pages.store.getState().projectId && lease.resourceKey === resourceKey)
        continue;
      lease.current = false;
      leases.delete(key);
    }
  };
  return {
    capture(identity: PlacementIdentity) {
      const core = resolveCore();
      const source = resolveSource(core, identity);
      if (!source) return () => false;
      if (!subscriptions.length) {
        subscriptions.push(
          observeWorkbenchStoreTransitions(core.layout.store, reconcile),
          observeWorkbenchStoreTransitions(core.pages.store, reconcile),
        );
      }
      const key = placementIdentityKey(identity);
      let lease = leases.get(key);
      if (!lease) {
        lease = {
          identity,
          projectId: core.pages.store.getState().projectId,
          resourceKey: source?.resource ? core.pages.resourceReferenceKey(source.resource) : undefined,
          current: Boolean(source),
        };
        leases.set(key, lease);
      }
      return () => lease.current;
    },
    dispose() {
      for (const lease of leases.values()) lease.current = false;
      leases.clear();
      for (const unsubscribe of subscriptions) unsubscribe();
      subscriptions.length = 0;
    },
  };
};
