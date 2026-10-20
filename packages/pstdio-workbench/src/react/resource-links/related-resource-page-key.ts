import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext, WorkbenchPageContribution, WorkbenchPagePersistenceScopeInput } from "../../core";
import { pageResourceContextKey } from "../../core/registries/pages/page-resource-context";

export const relatedResourceChoiceKey = (
  context: Pick<WorkbenchPagePersistenceScopeInput, "projectId" | "pageId" | "resource">,
  page: WorkbenchPageContribution | undefined,
) => JSON.stringify([context.projectId, context.pageId, pageResourceContextKey(page, context.resource)]);

export const relatedResourceStateKey = (
  state: ReturnType<WorkbenchModuleContext["pages"]["store"]["getState"]>,
  resource?: ResourceRef,
) =>
  relatedResourceChoiceKey(
    { projectId: state.projectId, pageId: state.activePageId, resource: resource ?? state.location?.resource },
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );

export const relatedResourcePageKey = (ctx: WorkbenchModuleContext, resource?: ResourceRef) => {
  const state = ctx.pages.store.getState();
  return relatedResourceStateKey(state, resource);
};
