import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchCore } from "../../workbench-core-types";

interface CloseGuard {
  current: () => boolean;
  prepare: () => Promise<void>;
}
const owners = new WeakMap<WorkbenchCore, Map<string, Set<CloseGuard>>>();

/** A placement stays mounted while its public editor sessions finish ordinary close. */
export const registerPlacementCloseGuard = (
  workbench: WorkbenchCore,
  identity: PlacementIdentity,
  prepare: () => Promise<void>,
) => {
  let placements = owners.get(workbench);
  if (!placements) {
    placements = new Map();
    owners.set(workbench, placements);
  }
  const key = placementIdentityKey(identity);
  let guards = placements.get(key);
  if (!guards) {
    guards = new Set();
    placements.set(key, guards);
  }
  const invocation = workbench.viewers.captureContext(identity);
  const guard = { prepare, current: () => invocation.isViewerCurrent?.() !== false };
  guards.add(guard);
  return () => {
    guards.delete(guard);
    if (!guards.size && placements.get(key) === guards) placements.delete(key);
  };
};

export const preparePlacementClose = (workbench: WorkbenchCore, identity: PlacementIdentity) => {
  const guards = owners.get(workbench)?.get(placementIdentityKey(identity));
  const current = [...(guards ?? [])].filter((guard) => guard.current());
  if (current.length) return Promise.all(current.map((guard) => guard.prepare())).then(() => {});
};
