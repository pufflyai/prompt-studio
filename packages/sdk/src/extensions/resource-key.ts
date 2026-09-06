import type { ResourceRef } from "pstdio-api-contracts/extension-kernel";

/** Stable identity for selection and reuse; labels and metadata do not change identity. */
export function resourceKey(resource: ResourceRef): string;
export function resourceKey(resource: ResourceRef | undefined): string | undefined;
export function resourceKey(resource: ResourceRef | undefined) {
  return resource && JSON.stringify([resource.extensionId ?? "", resource.projectId ?? "", resource.type, resource.id]);
}
