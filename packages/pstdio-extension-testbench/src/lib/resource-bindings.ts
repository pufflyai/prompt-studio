import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

// Contribution ids are namespaced as `<extension-name>.<localId>`. Resource refs use
// the local kind name (for example "ticket"), so bindings match on either form.
export const localContributionId = (id: string) => (id.includes(".") ? id.slice(id.indexOf(".") + 1) : id);

const matchesResourceKind = (kindId: string, kind: string) => kindId === kind || localContributionId(kindId) === kind;

export const viewIdsForResourceKind = (metadata: WorkbenchExtensionMetadata, kind: string) => [
  ...metadata.pages.flatMap((page) =>
    page.slots.flatMap((slot) => {
      const binding = "binding" in slot ? slot.binding : undefined;
      if (!binding) return [];
      const kinds = Array.isArray(binding.kind) ? binding.kind : [binding.kind];
      return kinds.some((candidate) => matchesResourceKind(candidate.id, kind)) ? [binding.view.id] : [];
    }),
  ),
  ...metadata.placements.flatMap((placement) => {
    const item = placement.item;
    if (item.kind !== "binding") return [];
    const kinds = Array.isArray(item.resourceKind) ? item.resourceKind : [item.resourceKind];
    return kinds.some((candidate) => matchesResourceKind(candidate.id, kind)) ? [item.view.id] : [];
  }),
];

export const isViewForResourceKind = (metadata: WorkbenchExtensionMetadata, viewId: string, kind: string) =>
  viewIdsForResourceKind(metadata, kind).includes(viewId);

export const isPageForResourceKind = (metadata: WorkbenchExtensionMetadata, pageId: string, kind: string) => {
  const page = metadata.pages.find((candidate) => candidate.localId === pageId);
  if (!page) return false;
  return page.slots.some((slot) => {
    const binding = "binding" in slot ? slot.binding : undefined;
    if (!binding) return false;
    const kinds = Array.isArray(binding.kind) ? binding.kind : [binding.kind];
    return kinds.some((candidate) => matchesResourceKind(candidate.id, kind));
  });
};

export const resourceKindsFromMetadata = (metadata: WorkbenchExtensionMetadata) => {
  const kinds = new Set<string>();
  for (const kind of metadata.resourceKinds) kinds.add(kind.localId);
  return [...kinds];
};
