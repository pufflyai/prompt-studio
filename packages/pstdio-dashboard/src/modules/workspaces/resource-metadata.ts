import type { ResourceRef } from "@pstdio/workbench";

export const resourceMetadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

export const resourceMetadataBoolean = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "boolean" ? value : undefined;
};
