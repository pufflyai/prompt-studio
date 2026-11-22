import type { ResourceRef } from "@pstdio/sdk/extensions";
import { contextualResourceRef } from "../../shared/contributions/resource-identity";
import { PAGE_MAIN_SLOT_ID } from "./page-main";
import type { WorkbenchPageLocationCommitInput } from "./page-registry-internals";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
} from "./page-registry-types";
import { pageResourceContextKey, pageResourceInstanceKey } from "./page-resource-context";
import { pageStateKey } from "./page-state-key";

export const currentPageResourceState = <Value>(
  page: WorkbenchPageContribution,
  target: WorkbenchPageLocationCommitInput,
  current: WorkbenchPageRegistryStoreState<Value>,
  resources: WorkbenchPageResourceCodec,
) => {
  if (
    !page.resource ||
    target.pageStates ||
    current.activePageId !== page.id ||
    current.projectId !== target.projectId ||
    !current.location?.resource ||
    !target.resource
  )
    return undefined;
  const kinds = page.resource.kinds;
  const normalize = (resource: ResourceRef) =>
    contextualResourceRef(resources.normalize(resource), target.projectId, kinds);
  const referenceKey = (resource: ResourceRef) => pageResourceContextKey(page, normalize(resource));
  const instanceKey = (resource: ResourceRef) => pageResourceInstanceKey(page, normalize(resource), resources);
  if (referenceKey(current.location.resource) !== referenceKey(target.resource)) return undefined;
  const state = current.pageStates[pageStateKey(page, current.location, resources)];
  if (!state) return undefined;
  const primaries = state.resourceInstances[PAGE_MAIN_SLOT_ID] ?? [];
  const primary = primaries.find((instance) => instance.instanceKey === state.activePrimaryInstanceKey);
  const retained = [
    ...(primary ? [primary] : []),
    ...primaries.filter((instance) => instance !== primary),
    ...page.slots
      .filter(
        (slot) =>
          slot.openOn === "page-resource" && slot.item.kind === "binding" && slot.item.binding.cardinality === "many",
      )
      .flatMap((slot) => state.resourceInstances[slot.id] ?? []),
  ];
  return {
    state,
    // Resolving a reference enriches its URI without replacing the live document's identity.
    resourceKey: (resource: ResourceRef) => {
      const existing = retained.find(
        (instance) =>
          referenceKey(instance.resource) === referenceKey(resource) &&
          instanceKey(instance.resource) === instanceKey(resource),
      );
      return existing?.instanceKey ?? pageResourceInstanceKey(page, resource, resources);
    },
  };
};
