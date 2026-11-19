import type { ProjectExtensionInstance } from "@pstdio/sdk/api";

export type ExtensionProvenanceFilter = "all" | "public" | "mine";
export const matchesExtensionProvenance = (
  extension: Partial<Pick<ProjectExtensionInstance, "visibility" | "ownership">>,
  filter: ExtensionProvenanceFilter,
) => {
  if (filter === "public") return extension.visibility === "public";
  if (filter === "mine") return extension.ownership === "mine";
  return true;
};
