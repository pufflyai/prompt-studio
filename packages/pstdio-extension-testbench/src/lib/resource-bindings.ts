import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

// Contribution ids are namespaced as `<extension-name>.<localId>`. Resource refs use
// the local kind name (for example "ticket"), so bindings match on either form.
export const localContributionId = (id: string) => (id.includes(".") ? id.slice(id.indexOf(".") + 1) : id);

const matchesResourceKind = (kindId: string, kind: string) => kindId === kind || localContributionId(kindId) === kind;

/** View ids bound to a resource kind through `resourceViews` edges. */
export const viewIdsForResourceKind = (metadata: WorkbenchExtensionMetadata, kind: string) =>
  metadata.resourceViews.filter((edge) => matchesResourceKind(edge.resourceKind.id, kind)).map((edge) => edge.view.id);

export const isViewForResourceKind = (metadata: WorkbenchExtensionMetadata, viewId: string, kind: string) =>
  viewIdsForResourceKind(metadata, kind).includes(viewId);

/** Local kind names from declared resource kinds, then from `resourceViews` edges. */
export const resourceKindsFromMetadata = (metadata: WorkbenchExtensionMetadata) => {
  const kinds = new Set<string>();
  for (const kind of metadata.resourceKinds) kinds.add(kind.localId);
  for (const edge of metadata.resourceViews) kinds.add(edge.resourceKind.id);
  return [...kinds];
};
