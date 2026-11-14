import type {
  ExtensionResourcesApi,
  RelatedResourceQuery,
  ResourceAnchor,
  ResourceAnchorQuery,
  ResourceRef,
} from "pstdio-api-contracts/extension-kernel";

type Edge = { source: ResourceRef; target: ResourceAnchor };
const withSavedPresentation = <T extends ResourceRef>(reference: T, saved: ResourceRef | undefined) => ({
  ...reference,
  ...Object.fromEntries(
    (["label", "icon", "shorthand"] as const).flatMap((key) => {
      const value = reference[key] ?? saved?.[key];
      return value === undefined ? [] : [[key, value]];
    }),
  ),
});
const relatedReferences = (
  query: RelatedResourceQuery,
  refs: Set<string>,
  edges: Map<string, Edge>,
  identity: (ref: ResourceRef) => string,
) => {
  const direction = query.direction ?? "outgoing";
  const found = new Map<string, ResourceRef>();
  const save = (ref: ResourceRef) => {
    if (query.excludeKinds?.includes(ref.type)) return;
    if ((!query.kind || ref.type === query.kind) && (!query.owner || ref.extensionId === query.owner))
      found.set(identity(ref), ref);
  };
  for (const { source, target } of edges.values()) {
    if (query.role && target.role !== query.role) continue;
    if (direction !== "outgoing" && refs.has(identity(target))) save(source);
  }
  for (const { source, target } of edges.values()) {
    if (query.role && target.role !== query.role) continue;
    if (direction !== "incoming" && refs.has(identity(source))) {
      const { role: _role, ...ref } = target;
      save(ref);
    }
  }

  return found;
};

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
  const list = async (query: Omit<ResourceAnchorQuery, "resource"> & { resources: ResourceRef[] }) => {
    const refs = new Set(query.resources.map((ref) => identity(canonical(ref))));
    const direction = query.direction ?? "outgoing";
    const limit = query.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
    const rows = [...input.edges.entries()]
      .filter(([key, edge]) => {
        const outgoing = refs.has(identity(edge.source)) && direction !== "incoming";
        const incoming = refs.has(identity(edge.target)) && direction !== "outgoing";
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
  };
  const api = {
    addAnchors: async (resource, anchors) => {
      const source = canonical(resource);
      const targets = anchors.map((anchor) => ({ ...canonical(anchor), role: anchor.role ?? "context" }));
      for (const target of targets) {
        const key = pair(source, target);
        const previous = input.edges.get(key);
        input.edges.set(key, {
          source: withSavedPresentation(source, previous?.source),
          target: withSavedPresentation(target, previous?.target),
        });
      }
    },
    removeAnchors: async (resource, refs) => {
      const source = canonical(resource);
      const targets = refs.map(canonical);
      for (const target of targets) input.edges.delete(pair(source, target));
    },
    listAnchors: (query: ResourceAnchorQuery) => list({ ...query, resources: [query.resource] }),
    removed: async (resource) => {
      const ref = identity(canonical(resource));
      for (const [key, edge] of input.edges)
        if (identity(edge.source) === ref || identity(edge.target) === ref) input.edges.delete(key);
    },
  } satisfies Pick<ExtensionResourcesApi, "addAnchors" | "removeAnchors" | "listAnchors" | "removed">;
  return {
    ...api,
    queryRelated: async (query: RelatedResourceQuery) => {
      if (query.resources.length > 100) throw new Error("Query at most 100 resources.");
      const limit = query.limit ?? 100;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
      const refs = new Set(query.resources.map((ref) => identity(canonical(ref))));
      const scope = JSON.stringify([
        [...refs].sort(),
        query.direction ?? "outgoing",
        query.role,
        query.kind,
        query.owner,
        query.excludeKinds,
      ]);
      const after = query.cursor ? JSON.parse(query.cursor) : undefined;
      if (after && (after.scope !== scope || typeof after.key !== "string"))
        throw new Error("Invalid related resource cursor.");
      const found = relatedReferences(query, refs, input.edges, identity);
      const ordered = [...found]
        .filter(([key]) => !after || key > after.key)
        .sort(([a], [b]) => (a < b ? -1 : Number(a !== b)));
      return {
        items: ordered.slice(0, limit).map(([, ref]) => ref),
        nextCursor: ordered.length > limit ? JSON.stringify({ scope, key: ordered[limit - 1]![0] }) : null,
      };
    },
    resolveMany: async () => [],
    queryAnchorsMany: async (query: Omit<ResourceAnchorQuery, "resource"> & { resources: ResourceRef[] }) => {
      if (query.resources.length > 100) throw new Error("Query at most 100 resources.");
      const page = await list(query);
      return { ...page, nextCursor: page.nextCursor ?? null };
    },
    queryAnchors: async (query: Parameters<typeof api.listAnchors>[0]) => {
      const page = await api.listAnchors(query);
      return { ...page, nextCursor: page.nextCursor ?? null };
    },
  };
};
