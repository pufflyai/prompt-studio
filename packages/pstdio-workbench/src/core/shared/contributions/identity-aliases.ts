import { historicalContributionId } from "pstdio-api-contracts/extension-host";

const indexes = new WeakMap<object, ReadonlyMap<string, string>>();
export const canonicalRegistryId = (registry: object, id: string) => indexes.get(registry)?.get(id) ?? id;
export const historicalRegistryId = (registry: object, id: string) => {
  for (const [previous, canonical] of indexes.get(registry) ?? []) if (canonical === id) return previous;
  return id;
};
export const registerRegistryAliases = (registry: object, aliases: ReadonlyMap<string, string>) => {
  indexes.set(registry, aliases);
  return {
    dispose: () => {
      if (indexes.get(registry) === aliases) indexes.delete(registry);
    },
  };
};

export const addContributionAlias = (
  aliases: Map<string, string>,
  record: {
    extensionId: string;
    localId: string;
    id: string;
  },
  kind: string,
) => {
  const previous = historicalContributionId({ extensionId: record.extensionId, kind, id: record.localId });
  if (previous) aliases.set(previous, record.id);
};
