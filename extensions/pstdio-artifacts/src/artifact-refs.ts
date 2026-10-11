import { qualifyRef } from "@pstdio/sdk/extensions";
import { extensionId } from "./events";

export const libraryPageRef = qualifyRef(extensionId, { kind: "page", id: "artifacts" } as const);
export const artifactPage = {
  id: "artifact",
  ref: qualifyRef(extensionId, { kind: "page", id: "artifact" } as const),
  path: "artifacts/view",
};
export const libraryPanelRef = qualifyRef(extensionId, {
  kind: "page-slot",
  page: libraryPageRef,
  id: "library",
} as const);
export const artifactPanelRef = qualifyRef(extensionId, {
  kind: "page-slot",
  page: libraryPageRef,
  id: "artifact",
} as const);
