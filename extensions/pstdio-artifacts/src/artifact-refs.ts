import { qualifyRef } from "@pstdio/sdk/extensions";
import { extensionId } from "./events";

export const libraryPageRef = qualifyRef(extensionId, { kind: "page", id: "artifacts" } as const);
export const libraryViewRef = qualifyRef(extensionId, { kind: "placement", id: "library" } as const);
export const artifactViewRef = qualifyRef(extensionId, { kind: "placement", id: "artifact" } as const);
/** @deprecated Use libraryViewRef. */
export const libraryPanelRef = qualifyRef(extensionId, {
  kind: "page-slot",
  page: libraryPageRef,
  id: "library",
} as const);
export const artifactPage = {
  id: "artifact",
  ref: qualifyRef(extensionId, { kind: "page", id: "artifact" } as const),
  path: "artifacts/view",
};
/** @deprecated Use artifactViewRef. */
export const artifactPanelRef = qualifyRef(extensionId, {
  kind: "page-slot",
  page: libraryPageRef,
  id: "artifact",
} as const);
