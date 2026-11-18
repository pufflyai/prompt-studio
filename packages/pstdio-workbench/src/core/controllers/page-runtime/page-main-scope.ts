import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";
import { historicalResourceRef } from "../../shared/contributions/resource-identity";
import type { WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { collectionMainOwner } from "./collection-main-owner";

export const mainScope = (
  context: WorkbenchPagePersistenceScopeInput,
  page: WorkbenchPageContribution | undefined,
  collection = false,
  identityId: (id: string) => string = (id) => id,
) =>
  `${collection ? "workbench-collection-main" : "workbench-main"}:${JSON.stringify([context.projectId, context.modeId && identityId(context.modeId), context.pageId && identityId(context.pageId), JSON.stringify([resourceKey(context.resource && historicalResourceRef(context.resource)), page?.document ? (context.resource?.metadata?.[page.document.metadataKey] ?? null) : null])])}`;

export const createPageMainScopes = (
  getPages: () => readonly WorkbenchPageContribution[],
  identityId: (id: string) => string = (id) => id,
) => {
  const pageMainOwner = (context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) => {
    const owner = collectionMainOwner(page, getPages());
    return {
      page: owner,
      context: owner && owner !== page ? { ...context, pageId: owner.id, resource: undefined } : context,
    };
  };
  const pageMainScope = (context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution | undefined) => {
    const owner = pageMainOwner(context, page);
    return mainScope(owner.context, owner.page, owner.page?.main.kind === "panels" && !owner.page.resource, identityId);
  };
  return { pageMainOwner, pageMainScope };
};
