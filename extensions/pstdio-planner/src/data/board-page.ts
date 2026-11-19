import { type CollectionPageSelection, readCollectionPage } from "@pstdio/sdk/data";
import type {
  CollectionPageGroup,
  ExtensionStorageApi,
  JsonValue,
  KanbanRendererAttributeDescriptor,
  StoragePredicate,
} from "@pstdio/sdk/extensions";

// Small finite schemas fit one aggregate. Other schemas retain every group by
// aggregating bounded ID partitions, without reading ticket bodies or raising host limits.
const fitsAggregate = (selection: CollectionPageSelection, attributes: KanbanRendererAttributeDescriptor[]) => {
  let combinations = 1;
  for (const group of selection.groups ?? []) {
    const type = attributes.find(({ id }) => id === group.field)?.type;
    if (type?.kind !== "enum") return false;
    combinations *= type.options.length + 1;
  }
  return combinations <= 500;
};

export const readBoardPage = async (
  storage: ExtensionStorageApi,
  selection: CollectionPageSelection,
  attributes: KanbanRendererAttributeDescriptor[],
) => {
  if (fitsAggregate(selection, attributes)) return readCollectionPage(storage, selection);
  const result = await readCollectionPage(storage, { ...selection, groups: [] });
  const { index, computed, formats, groups = [] } = selection;
  const where = { all: [selection.where, selection.search].filter((item) => item !== undefined) };
  const revision = result.page.revision;
  const counts = new Map<string, { value: JsonValue[]; count: number }>();
  let cursor: string | undefined;
  do {
    const ids = await storage.records.query({
      index,
      computed,
      formats,
      where,
      fields: ["id"],
      orderBy: [{ field: "id", direction: "asc" }],
      limit: 100,
      cursor,
      revision,
    });
    if (!ids.records.length) break;
    const selected: StoragePredicate = { field: "id", op: "in", value: ids.records.map(({ fields }) => fields.id) };
    const page = await storage.records.aggregate({
      index,
      computed,
      formats,
      where: { all: [where, selected] },
      groupBy: groups.map(({ indexField }) => indexField),
      groupLimit: 100,
    });
    if (page.revision !== revision) throw new Error("Collection query revision is stale; restart the query");
    for (const group of page.groups) {
      const key = JSON.stringify(group.value);
      const total = counts.get(key) ?? { value: group.value as JsonValue[], count: 0 };
      total.count += group.count;
      counts.set(key, total);
    }
    cursor = ids.cursor ?? undefined;
  } while (cursor);
  const parents = new Map<string, CollectionPageGroup>();
  const children: CollectionPageGroup[] = [];
  for (const group of counts.values()) {
    const parent = { field: groups[0].field, value: group.value[0] };
    const key = JSON.stringify(parent.value);
    const total = parents.get(key) ?? { ...parent, count: 0 };
    total.count += group.count;
    parents.set(key, total);
    if (groups.length === 2)
      children.push({ field: groups[1].field, value: group.value[1], count: group.count, parent });
  }
  return { ...result, page: { ...result.page, groups: [...parents.values(), ...children] } };
};
