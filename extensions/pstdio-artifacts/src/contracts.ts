import { parsePageUrl, qualifyRef, type ResourceRef, serializePageUrl } from "@pstdio/sdk/extensions";
import { detail, library } from "./pages";

export const extensionId = "pstdio.pstdio-artifacts";
export const artifactPage = {
  id: detail.id,
  ref: qualifyRef(extensionId, detail.ref),
  path: detail.path,
};
const libraryPageRef = qualifyRef(extensionId, library.ref);
export const libraryTarget = {
  kind: "compound" as const,
  targets: [
    { kind: "page" as const, page: libraryPageRef },
    { kind: "panel" as const, panel: qualifyRef(extensionId, library.panels.library) },
  ],
};
export const changedEvent = `${extensionId}.artifacts.changed`;

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
      panel: qualifyRef(extensionId, library.panels.artifact),
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
