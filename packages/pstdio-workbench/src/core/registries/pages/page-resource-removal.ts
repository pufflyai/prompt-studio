import type { PageLocation, PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { projectResourceReferences } from "../resources/project-resource-identity";
import { pageOwnerResource, primarySlot } from "./page-main";
import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "./page-registry-types";
import { pageStateKey } from "./page-state-key";

/** Reconcile the state owner, including pages that have no current layout widgets. */
export const removePageResource = <Value>(
  state: WorkbenchPageRegistryStoreState<Value>,
  resource: ResourceRef,
  resources: WorkbenchPageResourceCodec,
  _retained: readonly PlacementIdentity[],
) => {
  const key = (value: ResourceRef) =>
    resources.toUri(resources.normalize({ ...value, projectId: value.projectId ?? state.projectId }));
  const removedKey = key(resource);
  const removedOwners = new Set(
    Object.values(state.pages)
      .filter((page) => pageOwnerResource(page, resource))
      .flatMap((page) =>
        projectResourceReferences(resource, state.projectId).map((reference) =>
          pageStateKey(page, { page: page.ref, resource: reference }, resources),
        ),
      ),
  );
  const pageStates = Object.fromEntries(
    Object.entries(state.pageStates)
      .filter(([stateKey]) => !removedOwners.has(stateKey))
      .map(([stateKey, current]) => {
        const pageId = Object.keys(state.pages).find((id) => stateKey === id || stateKey.startsWith(`${id}|`));
        if (!pageId) return [stateKey, current];
        const resourceInstances = Object.fromEntries(
          Object.entries(current.resourceInstances).map(([slotId, instances]) => [
            slotId,
            instances.filter((instance) => key(instance.resource) !== removedKey),
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
    else location = location.parent ?? (page.parentId ? { page: state.pages[page.parentId]!.ref } : undefined);
  }
  const ancestors: PageLocation[] = [];
  for (let current = location; current; current = current.parent) {
    if (!current.resource || key(current.resource) !== removedKey) ancestors.push(current);
  }
  location = undefined;
  for (const ancestor of ancestors.reverse()) {
    const { parent: _parent, ...own } = ancestor;
    location = { ...own, ...(location ? { parent: location } : {}) };
  }
  return { pageStates, location };
};
