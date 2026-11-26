import { type QueryScope, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";

export const chatDraftOwnerKey = (
  projectId: string,
  viewId: string,
  resource: ResourceRef | undefined,
  draftKey: string,
) => JSON.stringify([projectId, viewId, resourceKey(resource) ?? draftKey]);
export const chatBrowserDraftKey = (
  storageScope: string | undefined,
  scope: Pick<QueryScope, "accountId" | "accountOrigin" | "projectId" | "extensionId">,
  owner: string,
) =>
  JSON.stringify([
    storageScope,
    scope.accountId ?? null,
    scope.accountOrigin ?? null,
    scope.projectId ?? null,
    scope.extensionId,
    owner,
  ]);
