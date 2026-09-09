import type { ExtensionResourcesApi } from "pstdio-api-contracts/extension-kernel";

export const createMemoryResources = (prefixes: Record<string, string>): ExtensionResourcesApi => {
  const sequences = new Map<string, number>();
  return {
    allocate: async ({ kind }) => {
      const prefix = prefixes[kind];
      if (!prefix) throw new Error(`Undeclared resource kind: ${kind}`);
      const next = (sequences.get(kind) ?? 0) + 1;
      sequences.set(kind, next);
      return { id: crypto.randomUUID(), shorthand: `${prefix}-${next}` };
    },
  };
};
