import { parsePageUrl, type ResourceRef, serializePageUrl } from "@pstdio/sdk/extensions";
import { artifactPage, artifactPanelRef, libraryPageRef, libraryPanelRef } from "./artifact-refs";
import { extensionId } from "./events";

export { artifactPage } from "./artifact-refs";

export { changedEvent, extensionId } from "./events";
export const libraryTarget = {
  kind: "compound" as const,
  targets: [
    { kind: "page" as const, page: libraryPageRef },
    { kind: "panel" as const, panel: libraryPanelRef },
  ],
};

export const artifactResource = (projectId: string, id: string, label?: string) =>
  ({
    type: "artifact",
    id,
    extensionId,
    projectId,
    ...(label ? { label } : {}),
  }) satisfies ResourceRef;

export const artifactTarget = (projectId: string, id: string, label?: string) => ({
  kind: "compound" as const,
  targets: [
    { kind: "page" as const, page: libraryPageRef },
    {
      kind: "panel" as const,
      panel: artifactPanelRef,
      resource: artifactResource(projectId, id, label),
      open: "pin" as const,
    },
  ],
});

export const artifactUrl = (projectId: string, id: string) =>
  serializePageUrl({ projectId, page: artifactPage, resource: artifactResource(projectId, id) });

export const artifactIdFromUrl = (projectId: string, url: string) => {
  // URLs identify host resources; they are never fetched as arbitrary network targets.
  if (!url.startsWith("/") || url.startsWith("//"))
    throw new Error("Use the internal artifact URL returned by publish.");
  const parsed = parsePageUrl({ projectId, url, pages: [artifactPage] });
  const resource = parsed?.resource;
  if (resource?.type !== "artifact" || resource.extensionId !== extensionId || resource.projectId !== projectId) {
    throw new Error("Invalid artifact URL for this project.");
  }
  return resource.id;
};
