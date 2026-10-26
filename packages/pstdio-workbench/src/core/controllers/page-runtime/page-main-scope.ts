import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { pageResourceContextKey } from "../../registries/pages/page-resource-context";
import type { WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { collectionMainOwner } from "./collection-main-owner";

export const mainScope = (
  context: WorkbenchPagePersistenceScopeInput,
  page: WorkbenchPageContribution | undefined,
  collection = false,
) =>
  `${collection ? "workbench-collection-main" : "workbench-main"}:${JSON.stringify([context.projectId, context.modeId, context.pageId, pageResourceContextKey(page, context.resource)])}`;

export const createPageMainScopes = (getPages: () => readonly WorkbenchPageContribution[]) => {
  const pageMainOwner = (context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) => {
    const owner = collectionMainOwner(page, getPages());
    return {
      page: owner,
      context: owner && owner !== page ? { ...context, pageId: owner.id, resource: undefined } : context,
    };
  };
  const pageMainScope = (context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) => {
    const owner = pageMainOwner(context, page);
    return mainScope(owner.context, owner.page, owner.page?.main.kind === "panels" && !owner.page.resource);
  };
  return { pageMainOwner, pageMainScope };
};
