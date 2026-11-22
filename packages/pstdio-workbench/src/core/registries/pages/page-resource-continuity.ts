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
  const referenceKey = (resource: ResourceRef) =>
    pageResourceContextKey(page, contextualResourceRef(resources.normalize(resource), target.projectId, kinds));
  if (referenceKey(current.location.resource) !== referenceKey(target.resource)) return undefined;
  const state = current.pageStates[pageStateKey(page, current.location, resources)];
  if (!state) return undefined;
  const primary = state.resourceInstances[PAGE_MAIN_SLOT_ID]?.find(
    (instance) => instance.instanceKey === state.activePrimaryInstanceKey,
  );
  return {
    state,
    // Resolving a reference enriches its URI without replacing the live document's identity.
    resourceKey: (resource: ResourceRef) =>
      primary && referenceKey(primary.resource) === referenceKey(resource)
        ? primary.instanceKey
        : pageResourceInstanceKey(page, resource, resources),
  };
};
