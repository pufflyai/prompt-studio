import {
  type CollectionPage,
  type CollectionPageGroup,
  type CollectionPageRequest,
  DEFAULT_COLLECTION_PAGE_SIZE,
  type StoragePredicate,
  type StorageRecordQueries,
  type StorageRecordQuery,
} from "pstdio-api-contracts/extension-kernel";
import { canonicalJson, type Json } from "pstdio-sync-contracts";

export interface CollectionPageSelection {
  index: string;
  /** The complete view filter, translated to declared index fields. */
  where?: StoragePredicate;
  /** Search is separate so total retains the count before search. */
  search?: StoragePredicate;
  /** Predicate excluding collapsed groups, applied before paging. */
  visible?: StoragePredicate;
  fields?: string[];
  orderBy?: StorageRecordQuery["orderBy"];
  groups?: { field: string; indexField: string }[];
  page?: CollectionPageRequest;
}

const together = (...predicates: (StoragePredicate | undefined)[]) => {
  const all = predicates.filter((predicate) => predicate !== undefined);
  return all.length ? { all } : undefined;
};

/** Select only a bounded page of projections, with global counts from the same revision.
 * Callers translate their view semantics to predicates; unsupported controls must fail before this call.
 */
export const readCollectionPage = async (
  storage: { records: Pick<StorageRecordQueries, "query" | "aggregate"> },
  selection: CollectionPageSelection,
) => {
  const { index, fields, orderBy, where, search, visible, groups = [], page } = selection;
  if (page?.search && !search) throw new Error("A nonempty search needs an indexed search predicate");
  if (page?.collapsedGroups?.length && !visible)
    throw new Error("Collapsed groups need an indexed collapsed-group predicate");
  if (groups.length > 2 || new Set(groups.map((group) => group.field)).size !== groups.length)
    throw new Error("Collection pages support at most two different grouping fields");
  const total = await storage.records.aggregate({ index, where });
  const revision = total.revision;
  const sameRevision = (actual: string) => {
    if (actual !== revision) throw new Error("Collection query revision is stale; restart the query");
  };
  if (page?.revision !== undefined) sameRevision(page.revision);
  const filtered =
    search || groups.length
      ? await storage.records.aggregate({
          index,
          where: together(where, search),
          ...(groups.length ? { groupBy: groups.map((group) => group.indexField), groupLimit: 500 } : {}),
        })
      : total;
  sameRevision(filtered.revision);
  const counts = visible
    ? await storage.records.aggregate({ index, where: together(where, search, visible) })
    : filtered;
  sameRevision(counts.revision);
  const selected = await storage.records.query({
    index,
    where: together(where, search, visible),
    fields,
    orderBy,
    limit: page?.limit ?? DEFAULT_COLLECTION_PAGE_SIZE,
    cursor: page?.cursor,
    offset: page?.cursor ? undefined : page?.offset,
    revision,
  });
  sameRevision(selected.revision);
  const groupCounts: CollectionPageGroup[] = [];
  const parents = new Map<string, CollectionPageGroup>();
  for (const group of filtered.groups) {
    const values = group.value as Json[];
    const parent = { field: groups[0].field, value: values[0] };
    const key = canonicalJson(parent.value);
    const count = parents.get(key) ?? { ...parent, count: 0 };
    count.count += group.count;
    parents.set(key, count);
    if (groups.length === 2)
      groupCounts.push({
        field: groups[1].field,
        value: values[1],
        count: group.count,
        parent,
      });
  }
  const result: CollectionPage = {
    revision,
    cursor: selected.cursor,
    total: total.count,
    filteredTotal: counts.count,
    groups: [...parents.values(), ...groupCounts],
  };
  return { records: selected.records, page: result };
};
