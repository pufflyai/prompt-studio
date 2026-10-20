import { createStorageId } from "pstdio-api-contracts";
import type { ExtensionResourcesApi } from "pstdio-api-contracts/extension-kernel";
import { createMemoryResourceLinks } from "./memory-resource-links";

// Sequence state is passed in so several contexts over the same storage keep counting
// from where the previous one left off, the way the host's per-project sequences do.
export const createMemoryResources = (
  prefixes: Record<string, string>,
  sequences = new Map<string, number>(),
  links = createMemoryResourceLinks({ projectId: "proj-1", extensionId: "test.extension", edges: new Map() }),
): ExtensionResourcesApi => ({
  ...links,
  allocate: async ({ kind, idPrefix }) => {
    const prefix = prefixes[kind];
    if (!prefix) throw new Error(`Undeclared resource kind: ${kind}`);
    const id = createStorageId(idPrefix);
    const next = (sequences.get(kind) ?? 0) + 1;
    sequences.set(kind, next);
    return { id, shorthand: `${prefix}-${next}` };
  },
});
