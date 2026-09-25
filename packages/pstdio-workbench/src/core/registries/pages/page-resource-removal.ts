import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { placementIdentityKey } from "../layout/placement-reconciliation";
import { primarySlot } from "./page-main";
import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "./page-registry-types";
import { pageStateKey } from "./page-state-key";

/** Reconcile the state owner, including pages that have no current layout widgets. */
export const removePageResource = <Value>(
  state: WorkbenchPageRegistryStoreState<Value>,
  resource: ResourceRef,
  resources: WorkbenchPageResourceCodec,
  retained: readonly PlacementIdentity[],
) => {
  const key = (value: ResourceRef) => resources.toUri(resources.normalize(value));
  const removedKey = key(resource);
  const keep = new Set(retained.map(placementIdentityKey));
  const pageStates = Object.fromEntries(
    Object.entries(state.pageStates).map(([stateKey, current]) => {
      const pageId = Object.keys(state.pages).find((id) => stateKey === id || stateKey.startsWith(`${id}|`));
      if (!pageId) return [stateKey, current];
      const resourceInstances = Object.fromEntries(
        Object.entries(current.resourceInstances).map(([slotId, instances]) => [
          slotId,
          instances.filter(
            (instance) =>
              key(instance.resource) !== removedKey ||
              keep.has(
                placementIdentityKey({
                  kind: "page",
                  pageId,
                  slotId,
                  instanceKey: instance.instanceKey,
                }),
              ),
          ),
        ]),
      );
      const primary = primarySlot(state.pages[pageId]!);
      const remaining = primary ? (resourceInstances[primary.id] ?? []) : [];
      let activePrimaryInstanceKey = current.activePrimaryInstanceKey;
      if (
        primary?.item.kind === "binding" &&
        !remaining.some((instance) => instance.instanceKey === activePrimaryInstanceKey)
      ) {
        activePrimaryInstanceKey = remaining.at(-1)?.instanceKey;
      }
      return [stateKey, { ...current, resourceInstances, activePrimaryInstanceKey }];
    }),
  );
  let location = state.location;
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  if (page && location?.resource && key(location.resource) === removedKey) {
    const current = pageStates[pageStateKey(page, location, resources)];
    const primary = primarySlot(page);
    const remaining = primary ? (current?.resourceInstances[primary.id] ?? []) : [];
    const active = remaining.find((instance) => instance.instanceKey === current?.activePrimaryInstanceKey);
    if (active) location = { ...location, resource: active.resource, section: active.section };
    else if (location.parent) location = location.parent;
    else if (page.parentId) location = { page: state.pages[page.parentId]!.ref };
  }
  return { pageStates, location };
};
