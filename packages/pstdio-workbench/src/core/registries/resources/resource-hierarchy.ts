import type { ResourceRef } from "./resource-registry";

// Hierarchy comes from resource identity: providers resolve a resource's parent,
// and the walk below turns those edges into the root-to-leaf breadcrumb path.
export interface ResourceHierarchyProvider {
  id: string;
  priority?: number;
  canResolve(resource: ResourceRef): boolean;
  getParent(resource: ResourceRef): ResourceRef | undefined;
}

export type ResolvedResourceHierarchyProvider = Required<ResourceHierarchyProvider>;

export const resourceHierarchyCycleCode = "resource_hierarchy_cycle";

// Emitted when parent resolution repeats a resource URI. Traversal keeps the
// acyclic root-to-leaf prefix, so consumers such as breadcrumbs stay usable
// while the faulty provider is diagnosed.
export interface ResourceHierarchyCycle {
  code: typeof resourceHierarchyCycleCode;
  path: ResourceRef[];
  repeatedUri: string;
}

export const sortHierarchyProviders = (providers: ResolvedResourceHierarchyProvider[]) =>
  [...providers].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

export const walkResourceHierarchy = (
  providers: ResolvedResourceHierarchyProvider[],
  resource: ResourceRef,
  notifyCycle: (cycle: ResourceHierarchyCycle) => void,
) => {
  const sorted = sortHierarchyProviders(providers);
  const path = [resource];
  const visitedUris = new Set([resource.uri]);
  let current = resource;

  while (true) {
    const provider = sorted.find((candidate) => candidate.canResolve(current));
    const parent = provider?.getParent(current);
    if (!parent) break;

    if (visitedUris.has(parent.uri)) {
      // A repeated URI means the providers formed a cycle. Keep the acyclic
      // prefix and surface the fault instead of looping or dropping the path.
      notifyCycle({ code: resourceHierarchyCycleCode, path: [...path], repeatedUri: parent.uri });
      break;
    }

    path.unshift(parent);
    visitedUris.add(parent.uri);
    current = parent;
  }

  return path;
};
