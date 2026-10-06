import type { ResourceRef } from "@pstdio/workbench";

export const resourceMetadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};
