import type { ExtensionResourcesApi, ResourceIdentity } from "@pstdio/sdk/extensions";
import { createMemoryResources } from "@pstdio/sdk/testing";

export const createBenchResources = (prefixes: Record<string, string>, seeds: ResourceIdentity[] = []) => {
  const byId = new Map(seeds.map((identity) => [identity.id, identity]));
  const sequences = new Map<string, number>();
  for (const identity of seeds) {
    const prefix = `${prefixes[identity.kind]}-`;
    if (!identity.shorthand.startsWith(prefix)) continue;
    const sequence = Number(identity.shorthand.slice(prefix.length));
    if (Number.isSafeInteger(sequence) && sequence > 0)
      sequences.set(identity.kind, Math.max(sequences.get(identity.kind) ?? 0, sequence));
  }
  const allocated = createMemoryResources(prefixes, sequences);
  const seededIdentity = (kind: string, id: string) => {
    const identity = byId.get(id);
    return identity?.kind === kind ? structuredClone(identity) : null;
  };
  const resources: ExtensionResourcesApi = {
    ...allocated,
    identity: async (input) => seededIdentity(input.kind, input.id) ?? allocated.identity(input),
    identityMany: async (input) => {
      const identities = await allocated.identityMany(input);
      return input.ids.map((id, index) => seededIdentity(input.kind, id) ?? identities[index] ?? null);
    },
    findByShorthand: async (input) => {
      const matches = [
        ...seeds.filter(
          (identity) =>
            identity.kind === input.kind &&
            (identity.shorthand === input.shorthand || identity.aliases.includes(input.shorthand)),
        ),
        ...(await allocated.findByShorthand(input)),
      ];
      return structuredClone(
        matches.sort((a, b) => Number(b.shorthand === input.shorthand) - Number(a.shorthand === input.shorthand)),
      );
    },
  };
  return resources;
};
