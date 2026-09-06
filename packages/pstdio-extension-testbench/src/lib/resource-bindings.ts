import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

export const localContributionId = (id: string) => (id.includes(".") ? id.slice(id.indexOf(".") + 1) : id);
const matchesResourceKind = (kindId: string, kind: string) => kindId === kind || localContributionId(kindId) === kind;

export const viewIdsForResourceKind = (metadata: WorkbenchExtensionMetadata, kind: string) => [
  ...metadata.pages.flatMap((page) => [
    ...(page.main.kind === "view" && page.resource?.kinds.some((ref) => matchesResourceKind(ref.id, kind))
      ? [page.main.view.id]
      : []),
    ...page.slots.flatMap((slot) => {
      const item = slot.item;
      if (item.kind !== "binding") return [];
      return item.binding.kinds.some((ref) => matchesResourceKind(ref.id, kind)) ? [item.binding.view.id] : [];
    }),
  ]),
  ...metadata.placements.flatMap((placement) => {
    const item = placement.item;
    if (item.kind !== "binding") return [];
    return item.binding.kinds.some((ref) => matchesResourceKind(ref.id, kind)) ? [item.binding.view.id] : [];
  }),
];
export const isViewForResourceKind = (metadata: WorkbenchExtensionMetadata, viewId: string, kind: string) =>
  viewIdsForResourceKind(metadata, kind).includes(viewId);
export const isPageForResourceKind = (metadata: WorkbenchExtensionMetadata, pageId: string, kind: string) =>
  metadata.pages
    .find((page) => page.localId === pageId)
    ?.resource?.kinds.some((ref) => matchesResourceKind(ref.id, kind)) ?? false;
export const resourceKindsFromMetadata = (metadata: WorkbenchExtensionMetadata) => [
  ...new Set(metadata.resourceKinds.map((kind) => kind.localId)),
];
