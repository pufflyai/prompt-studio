import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "../../core";
import { pageResourceContextKey } from "../../core/registries/pages/page-resource-context";

export const relatedResourceStateKey = (
  state: ReturnType<WorkbenchModuleContext["pages"]["store"]["getState"]>,
  resource?: ResourceRef,
) =>
  JSON.stringify([
    state.projectId,
    state.activePageId,
    pageResourceContextKey(
      state.activePageId ? state.pages[state.activePageId] : undefined,
      resource ?? state.location?.resource,
    ),
  ]);

export const relatedResourcePageKey = (ctx: WorkbenchModuleContext, resource?: ResourceRef) => {
  const state = ctx.pages.store.getState();
  return relatedResourceStateKey(state, resource);
};
