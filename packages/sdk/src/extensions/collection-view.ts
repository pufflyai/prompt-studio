import type {
  DataTableRendererColumn,
  DataTableRendererQueryParams,
  DataTableRendererQueryResult,
  ExtensionContextBase,
  KanbanRendererAttributeDescriptor,
  KanbanRendererQueryParams,
  KanbanRendererQueryResult,
  RendererCallback,
  StorageRecordIndex,
} from "pstdio-api-contracts/extension-kernel";
import { type CollectionViewSelection, readCollectionViewPage } from "../data/collection-view";
import type { CollectionQueryField } from "../data/collection-view-filter";
import { readCollectionTableStatistics } from "./collection-table-statistics";

const selections = new WeakMap<object, (params: KanbanRendererQueryParams) => CollectionViewSelection>();
const indexes = new WeakMap<object, StorageRecordIndex>();
export const collectionQueryIndex = (query: unknown) => (typeof query === "function" ? indexes.get(query) : undefined);

/** A collection projection is the source of a native board or resource list.
 * defineExtension installs its index. The provider selects projections only;
 * documents are opened separately through their resource.
 */
export const collectionViewQuery = (input: {
  index: StorageRecordIndex;
  attributes?: KanbanRendererAttributeDescriptor[];
  resourceKind?: string;
  idField?: string;
  titleField?: string;
  fields?: Record<string, CollectionQueryField>;
}) => {
  const { index, attributes = [], idField = "id", titleField = "title" } = input;
  const fields: Record<string, CollectionQueryField> = {
    title: { field: titleField, kind: "string", sortable: true },
    ...input.fields,
  };
  for (const attribute of attributes)
    fields[attribute.id] ??= {
      field: attribute.id,
      kind: attribute.type.kind,
      sortable: attribute.sortable === true,
      filterable: attribute.filterable !== false,
      ...(attribute.type.kind === "boolean" ? { legacyValues: attribute.type.legacyValues } : {}),
      emptyGroup: `No ${(typeof attribute.label === "string" ? attribute.label : (attribute.label.default ?? attribute.label.$l10n)).toLowerCase()}`,
      ...("options" in attribute.type
        ? {
            options: attribute.type.options.map(({ value, label }) => ({
              value,
              label: typeof label === "string" ? label : (label.default ?? label.$l10n),
            })),
          }
        : {}),
    };
  const selection = (params: KanbanRendererQueryParams): CollectionViewSelection => ({
    index: index.name,
    fields,
    select: [
      ...new Set([
        idField,
        titleField,
        ...(params.page?.fields ?? []).flatMap((name) => (fields[name] ? [fields[name].field] : [])),
      ]),
    ],
    where: { field: idField, op: "notEmpty" },
    filter: params.filter,
    sorts: params.sorts,
    orderBy: index.orderBy,
    groups: [params.settings?.columnGrouping ?? "none", params.settings?.rowGrouping ?? "none"],
    searchFields: params.page?.searchFields ?? params.page?.fields ?? ["title"],
    page: params.page,
  });

  const query = async (ctx: ExtensionContextBase, params: KanbanRendererQueryParams) => {
    const result = await readCollectionViewPage(ctx.storage, selection(params));
    return {
      attributes,
      page: result.page,
      rows: result.records.map(({ fields: values }) => {
        const id = String(values[idField]),
          title = String(values[titleField] ?? "");
        return {
          id,
          title,
          attributes: Object.fromEntries(
            Object.entries(fields).map(([name, { field }]) => [name, values[field] ?? null]),
          ),
          ...(input.resourceKind
            ? {
                resource: {
                  type: input.resourceKind,
                  id,
                  extensionId: ctx.extensionId,
                  projectId: ctx.projectId,
                  label: title,
                },
              }
            : {}),
        };
      }),
    } satisfies KanbanRendererQueryResult;
  };
  indexes.set(query, index);
  selections.set(query, selection);
  return query;
};

/** The same indexed source for native data tables. */
export const collectionTableQuery = (
  input: Omit<Parameters<typeof collectionViewQuery>[0], "attributes"> & { columns: DataTableRendererColumn[] },
) => {
  const { columns } = input;
  const source = collectionViewQuery({
    ...input,
    attributes: columns.map((column) => ({
      ...column,
      label: column.label ?? column.id,
      type: { kind: column.type ?? "string" },
      sortable: true,
    })),
  });
  const query: RendererCallback<DataTableRendererQueryParams, DataTableRendererQueryResult> = async (ctx, params) => {
    const sourceParams = {
      ...params,
      settings: {
        viewMode: "list",
        columnGrouping: params.settings?.grouping ?? "none",
        rowGrouping: "none",
        displayProperties: columns.map(({ id }) => id),
      },
    } as KanbanRendererQueryParams;
    const result = await source(ctx, sourceParams);
    const statistics = result.page
      ? await readCollectionTableStatistics(
          ctx.storage,
          selections.get(source)!(sourceParams),
          columns,
          params.settings,
          result.page.revision,
        )
      : {};
    return {
      columns,
      page: result.page ? { ...result.page, statistics } : undefined,
      rows: result.rows.map(({ id, title, attributes, resource }) => ({
        id,
        values: { ...attributes, [input.titleField ?? "title"]: title },
        resource,
      })),
    };
  };
  indexes.set(query, input.index);
  return query;
};
