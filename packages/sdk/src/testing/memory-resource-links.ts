import type { ExtensionResourcesApi, ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";

type Edge = { source: ResourceRef; target: ResourceAnchor };
export const createMemoryResourceLinks = (input: {
  projectId: string;
  extensionId: string;
  edges: Map<string, Edge>;
}) => {
  const canonical = (ref: ResourceRef) => {
    if (ref.projectId && ref.projectId !== input.projectId) throw new Error("Resource belongs to another project.");
    return { ...ref, projectId: input.projectId, extensionId: ref.extensionId ?? input.extensionId };
  };
  const identity = (ref: ResourceRef) => JSON.stringify([ref.projectId, ref.extensionId, ref.type, ref.id]);
  const pair = (source: ResourceRef, target: ResourceRef) => JSON.stringify([identity(source), identity(target)]);
  return {
    addAnchors: async (resource, anchors) => {
      const source = canonical(resource);
      const targets = anchors.map((anchor) => ({ ...canonical(anchor), role: anchor.role ?? "context" }));
      for (const target of targets) input.edges.set(pair(source, target), { source, target });
    },
    removeAnchors: async (resource, refs) => {
      const source = canonical(resource);
      const targets = refs.map(canonical);
      for (const target of targets) input.edges.delete(pair(source, target));
    },
    listAnchors: async (query) => {
      const ref = identity(canonical(query.resource));
      const direction = query.direction ?? "outgoing";
      const limit = query.limit ?? 50;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
      const rows = [...input.edges.entries()]
        .filter(([key, edge]) => {
          const outgoing = identity(edge.source) === ref && direction !== "incoming";
          const incoming = identity(edge.target) === ref && direction !== "outgoing";
          return (
            (outgoing || incoming) &&
            (!query.role || edge.target.role === query.role) &&
            (!query.cursor || key > query.cursor)
          );
        })
        .sort(([a], [b]) => {
          if (a === b) return 0;
          return a < b ? -1 : 1;
        });
      return {
        items: rows.slice(0, limit).map(([, edge]) => edge),
        ...(rows.length > limit ? { nextCursor: rows[limit - 1]![0] } : {}),
      };
    },
    removed: async (resource) => {
      const ref = identity(canonical(resource));
      for (const [key, edge] of input.edges)
        if (identity(edge.source) === ref || identity(edge.target) === ref) input.edges.delete(key);
    },
  } satisfies Pick<ExtensionResourcesApi, "addAnchors" | "removeAnchors" | "listAnchors" | "removed">;
};
