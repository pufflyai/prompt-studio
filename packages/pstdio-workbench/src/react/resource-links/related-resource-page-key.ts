import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "../../core";

export const relatedResourcePageKey = (ctx: WorkbenchModuleContext, resource?: ResourceRef) => {
  const state = ctx.pages.store.getState();
  return JSON.stringify([state.projectId, state.activePageId, resourceKey(resource ?? state.location?.resource)]);
};
