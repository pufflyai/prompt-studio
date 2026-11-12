import { parsePageUrl, type ResourceRef, serializePageUrl } from "@pstdio/sdk/extensions";
import { artifactPage, libraryPageRef } from "./artifact-refs";
import { extensionId } from "./events";

export { artifactPage } from "./artifact-refs";

export { changedEvent, extensionId } from "./events";
export const libraryTarget = {
  kind: "page" as const,
  page: libraryPageRef,
};

export const artifactResource = (projectId: string, id: string, label?: string, owner = extensionId) =>
  ({
    type: "artifact",
    id,
    extensionId: owner,
    projectId,
    ...(label ? { label } : {}),
  }) satisfies ResourceRef;

export const artifactTarget = (projectId: string, id: string, label?: string, owner = extensionId) => ({
  kind: "page" as const,
  page: { ...artifactPage.ref, extensionId: owner },
  resource: artifactResource(projectId, id, label, owner),
  open: "pin" as const,
});

export const artifactUrl = (projectId: string, id: string, owner = extensionId) =>
  serializePageUrl({
    projectId,
    page: { ...artifactPage, ref: { ...artifactPage.ref, extensionId: owner } },
    resource: artifactResource(projectId, id, undefined, owner),
  });

export const artifactIdFromUrl = (projectId: string, url: string, owner = extensionId) => {
  // URLs identify host resources; they are never fetched as arbitrary network targets.
  if (!url.startsWith("/") || url.startsWith("//"))
    throw new Error("Use the internal artifact URL returned by publish.");
  const parsed = parsePageUrl({
    projectId,
    url,
    pages: [artifactPage, { ...artifactPage, ref: { ...artifactPage.ref, extensionId: owner } }],
  });
  const resource = parsed?.resource;
  if (
    resource?.type !== "artifact" ||
    ![extensionId, owner].includes(resource.extensionId ?? "") ||
    resource.projectId !== projectId
  ) {
    throw new Error("Invalid artifact URL for this project.");
  }
  return resource.id;
};
