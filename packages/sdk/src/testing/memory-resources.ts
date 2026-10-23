import { createStorageId } from "pstdio-api-contracts";
import type { ExtensionResourcesApi, ResourceIdentity } from "pstdio-api-contracts/extension-kernel";
import { createMemoryResourceLinks } from "./memory-resource-links";

const identitiesBySequence = new WeakMap<
  Map<string, number>,
  Map<string, { identity: ResourceIdentity; scope: string }>
>();

// Contexts sharing a sequence also share the identities it allocated.
export const createMemoryResources = (
  prefixes: Record<string, string>,
  sequences = new Map<string, number>(),
  links = createMemoryResourceLinks({ projectId: "proj-1", extensionId: "test.extension", edges: new Map() }),
  owner = { projectId: "proj-1", extensionId: "test.extension" },
): ExtensionResourcesApi => {
  const scope = JSON.stringify([owner.projectId, owner.extensionId]);
  let identities = identitiesBySequence.get(sequences);
  if (!identities) {
    identities = new Map();
    identitiesBySequence.set(sequences, identities);
  }
  const resources = identities;
  return {
    ...links,
    allocate: async ({ kind, idPrefix }) => {
      const prefix = prefixes[kind];
      if (!prefix) throw new Error(`Undeclared resource kind: ${kind}`);
      const id = createStorageId(idPrefix);
      const next = (sequences.get(kind) ?? 0) + 1;
      sequences.set(kind, next);
      const identity = { id, kind, shorthand: `${prefix}-${next}`, aliases: [] };
      resources.set(identity.id, { identity, scope });
      return { id: identity.id, shorthand: identity.shorthand };
    },
    identity: async ({ kind, id }) => {
      const found = resources.get(id);
      return found?.scope === scope && found.identity.kind === kind ? structuredClone(found.identity) : null;
    },
    identityMany: async ({ kind, ids }) => {
      if (ids.length > 100) throw new Error("An identity batch can read at most 100 resources");
      return ids.map((id) => {
        const found = resources.get(id);
        return found?.scope === scope && found.identity.kind === kind ? structuredClone(found.identity) : null;
      });
    },
    findByShorthand: async ({ kind, shorthand }) =>
      [...resources.values()]
        .filter((entry) => entry.scope === scope)
        .map((entry) => entry.identity)
        .filter(
          (resource) =>
            resource.kind === kind && (resource.shorthand === shorthand || resource.aliases.includes(shorthand)),
        )
        .sort((a, b) => Number(b.shorthand === shorthand) - Number(a.shorthand === shorthand))
        .map((resource) => structuredClone(resource)),
  };
};
