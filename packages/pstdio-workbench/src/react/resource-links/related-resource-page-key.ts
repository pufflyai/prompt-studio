import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "../../core";

export const relatedResourceStateKey = (
  state: ReturnType<WorkbenchModuleContext["pages"]["store"]["getState"]>,
  resource?: ResourceRef,
) => JSON.stringify([state.projectId, state.activePageId, resourceKey(resource ?? state.location?.resource)]);

export const relatedResourcePageKey = (ctx: WorkbenchModuleContext, resource?: ResourceRef) => {
  const state = ctx.pages.store.getState();
  return relatedResourceStateKey(state, resource);
};
