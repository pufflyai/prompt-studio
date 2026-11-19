import type { StoragePredicate, StorageRecordIndex } from "pstdio-sync-contracts";
import { validateComputedConditions } from "./record-query";
import { relatedQueryIndexes } from "./record-query-options";

/** Load index metadata only. Resources remain in the query engine. */
export const loadQueryIndexDependencies = async (
  root: StorageRecordIndex | undefined,
  where: StoragePredicate | undefined,
  read: (name: string) => Promise<StorageRecordIndex>,
) => {
  const definitions = new Map<string, StorageRecordIndex>();
  if (root) definitions.set(root.name, root);
  const lookups = (index?: StorageRecordIndex) =>
    Object.values(index?.fields ?? {}).flatMap((field) => [
      ...(field.lookup ? [field.lookup.index] : []),
      ...(field.cases ?? []).flatMap((entry) => relatedQueryIndexes(entry.when)),
    ]);
  const pending = [...relatedQueryIndexes(where), ...lookups(root)];
  while (pending.length) {
    const name = pending.pop()!;
    if (definitions.has(name)) continue;
    const index = await read(name);
    definitions.set(name, index);
    if (definitions.size > 16 + Number(Boolean(root))) throw new Error("Query needs at most 16 related indexes");
    pending.push(...lookups(index));
  }
  const resolve = (name: string) => {
    const index = definitions.get(name);
    if (!index) throw new Error(`Storage index not installed: ${name}`);
    return index;
  };
  for (const definition of definitions.values()) validateComputedConditions(definition, resolve);
  return {
    resolve,
    definitions: [...definitions.values()],
    hasIdentity: [...definitions.values()].some((index) => Boolean(index.identity)),
  };
};
