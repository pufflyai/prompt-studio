import { qualifyRef } from "@pstdio/sdk/extensions";
import { extensionId } from "./events";

export const libraryPageRef = qualifyRef(extensionId, { kind: "page", id: "artifacts" } as const);
export const artifactPage = {
  id: "artifact",
  ref: qualifyRef(extensionId, { kind: "page", id: "artifact" } as const),
  path: "artifacts/view",
};
