import type {
  CollectionPageStatistic,
  DataTableRendererColumn,
  DataTableRendererSettings,
  ExtensionStorageApi,
  StorageAggregateQuery,
} from "pstdio-api-contracts/extension-kernel";
import { type CollectionViewSelection, collectionViewSelection } from "../data/collection-view";

export const readCollectionTableStatistics = async (
  storage: ExtensionStorageApi,
  input: CollectionViewSelection,
  columns: DataTableRendererColumn[],
  settings: DataTableRendererSettings,
  revision: string,
) => {
  const visible = columns.filter(
    (column) => column.stat && !column.hidden && !settings.hiddenColumns.includes(column.id),
  );
  const result: Record<string, CollectionPageStatistic> = {};
  if (!settings.showStats || !visible.length) return result;
  const scope = collectionViewSelection(input);
  for (let start = 0; start < visible.length; start += 16) {
    const statistics: NonNullable<StorageAggregateQuery["statistics"]> = {};
    for (const column of visible.slice(start, start + 16)) {
      const field = input.fields[column.id];
      if (!field) throw new Error(`Column ${column.id} needs a scalar query projection for statistics`);
      statistics[column.id] = {
        ...column.stat!,
        field: field.field,
        ...(column.stat!.type === "top-values" ? { locale: input.page?.viewer?.locale } : {}),
      };
    }
    const aggregate = await storage.records.aggregate({
      index: scope.index,
      computed: scope.computed,
      formats: scope.formats,
      where: { all: [scope.where, scope.search, scope.visible].filter((part) => part !== undefined) },
      statistics,
    });
    if (aggregate.revision !== revision) throw new Error("Collection query revision is stale; restart the query");
    Object.assign(result, aggregate.statistics);
  }
  return result;
};
