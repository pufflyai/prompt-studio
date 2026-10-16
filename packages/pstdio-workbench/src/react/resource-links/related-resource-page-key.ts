import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "../../core";

export const relatedResourcePageKey = (ctx: WorkbenchModuleContext) => {
  const state = ctx.pages.store.getState();
  return JSON.stringify([state.projectId, state.activePageId, resourceKey(state.location?.resource)]);
};
