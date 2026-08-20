import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";

// Contribution ids are namespaced as `<extension-name>.<localId>`. Resource refs use
// the local kind name (for example "ticket"), so bindings match on either form.
export const localContributionId = (id: string) => (id.includes(".") ? id.slice(id.indexOf(".") + 1) : id);

const matchesResourceKind = (kindId: string, kind: string) => kindId === kind || localContributionId(kindId) === kind;

/** Panel ids bound to a resource kind through `resourcePanels` edges. */
export const panelIdsForResourceKind = (metadata: WorkbenchExtensionMetadata, kind: string) =>
  (metadata.resourcePanels ?? [])
    .filter((edge) => matchesResourceKind(edge.resourceKind, kind))
    .map((edge) => edge.panel);

export const isPanelForResourceKind = (metadata: WorkbenchExtensionMetadata, panelId: string, kind: string) =>
  panelIdsForResourceKind(metadata, kind).includes(panelId);

/** Local kind names from declared resource kinds, then from `resourcePanels` edges. */
export const resourceKindsFromMetadata = (metadata: WorkbenchExtensionMetadata) => {
  const kinds = new Set<string>();
  for (const kind of metadata.resourceKinds ?? []) kinds.add(localContributionId(kind.id));
  for (const edge of metadata.resourcePanels ?? []) kinds.add(localContributionId(edge.resourceKind));
  return [...kinds];
};
