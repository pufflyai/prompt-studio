import type { ResourceBrowseEntry, ResourceRef } from "@pstdio/workbench";

export interface ResourceParamOption {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  value: string;
}

const toExtensionResource = (resource: ResourceRef) => ({
  type: resource.kind,
  id: resource.id ?? resource.uri,
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
    if ((resourceType && resource.kind !== resourceType) || seen.has(resource.uri)) return [];
    seen.add(resource.uri);
    return [
      {
        id: resource.uri,
        name: resource.label ?? resource.id ?? resource.uri,
        description: entry.description,
        icon: resource.icon,
        value: JSON.stringify(toExtensionResource(resource)),
      },
    ];
  });
};
