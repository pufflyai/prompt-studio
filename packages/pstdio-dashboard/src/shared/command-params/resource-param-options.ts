import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceBrowseEntry, ResourceRef } from "@pstdio/workbench";
export interface ResourceParamOption {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  value: string;
}
const toExtensionResource = (resource: ResourceRef) => ({
  type: resource.type,
  id: resource.id ?? resourceKey(resource),
  ...(resource.label ? { label: resource.label } : {}),
  ...(resource.metadata ? { metadata: resource.metadata } : {}),
});
export const buildResourceParamOptions = (
  entries: readonly ResourceBrowseEntry[],
  resourceType: string | undefined,
) => {
  const seen = new Set<string>();
  return entries.flatMap((entry): ResourceParamOption[] => {
    const { resource } = entry;
    if ((resourceType && resource.type !== resourceType) || seen.has(resourceKey(resource))) return [];
    seen.add(resourceKey(resource));
    return [
      {
        id: resourceKey(resource),
        name: resource.label ?? resource.id ?? resourceKey(resource),
        description: entry.description,
        icon: resource.icon,
        value: JSON.stringify(toExtensionResource(resource)),
      },
    ];
  });
};
