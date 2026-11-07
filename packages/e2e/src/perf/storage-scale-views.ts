import {
  type CollectionPageRequest,
  defineCommand,
  definePage,
  defineView,
  type ExtensionStorageApi,
  eventRef,
  params,
  type ViewFilterGroup,
  type ViewSort,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import {
  editOperation,
  pageRows,
  rowSummary,
  type Selection,
  type SummaryFields,
  scaleScopePredicate,
  scaleSelectionPredicate,
  type Workload,
  workload,
} from "storage-scale-fixture";

interface PagedInput {
  page?: CollectionPageRequest;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
}

const summaryIndexFields = ["id", "title", "ordinal", "tags", "progress", "content"];

// Each view requests one bounded page through the declared scale indexes. The fixed selection
// is the view; other filters, sorts or searches are outside this benchmark and are refused.
const readPage = async (
  storage: ExtensionStorageApi,
  input: PagedInput,
  selection: Selection,
  count: number,
  fields: string[],
) => {
  const request = input.page;
  if (!request) throw new Error("Scale views require the bounded page contract");
  if (input.filter.rules.length || input.filter.groups?.length || input.sorts.length || request.search.trim())
    throw new Error("Scale views show only their fixed selection");
  const index = "scale-rows";
  const where = scaleScopePredicate(false, scaleSelectionPredicate(count, selection));
  const rows = await storage.records.query({
    index,
    where,
    fields,
    limit: request.limit,
    ...(request.cursor ? { cursor: request.cursor } : { offset: request.offset }),
    revision: request.revision,
  });
  const selected = await storage.records.aggregate({ index, where });
  if (selected.revision !== rows.revision) throw new Error("Scale rows changed while reading one page");
  return {
    records: rows.records,
    page: {
      revision: rows.revision,
      cursor: rows.cursor,
      total: selected.count,
      filteredTotal: selected.count,
      groups: [],
    },
  };
};

// Ordinary public-API consumer views, using the existing native renderers and command form.
export const createScaleViews = (kind: Workload, index: number, count: number) => {
  const changed = eventRef({ extensionId: `scale.scale-owner-${index}`, id: "rows.changed" });
  const schema = {
    operation: params.text({ label: "Operation", required: true }),
    nonce: params.text({ label: "Save identity", required: true }),
  };
  const target = pageRows(workload(kind), index, "focus", 0)[0];
  const save = defineCommand({
    id: "save-edit",
    title: "Edit resource",
    mutating: true,
    params: schema,
    async run(ctx, input) {
      const edit = editOperation(kind, input.operation, input.nonce, count, target.ordinal, index);
      const started = performance.now();
      const outcome = await ctx.storage.records.commit({
        operationId: input.nonce,
        edits: [
          ...edit.change.rows.map((row) => ({ recordId: ctx.storage.records.id(row.id), replace: row })),
          ...edit.change.deleted.map((id) => ({ recordId: ctx.storage.records.id(id), deleted: true })),
        ],
      });
      const durableAckMs = performance.now() - started;
      await ctx.events.emit(changed, {});
      return { outcome, durableAckMs, recordId: edit.recordId };
    },
  });
  const toolbarActions = [
    { id: "edit", label: "Edit resource", command: save.ref, input: schema, submitLabel: "Save resource" },
  ];
  const views = (["board", "list"] as const).map((mode) =>
    defineView({
      id: `records-${mode}`,
      title: "Records",
      body: {
        kind: "kanban",
        toolbarActions,
        refreshEvents: [changed],
        attributes: [{ id: "summary", label: "Saved values", type: { kind: "string" }, displayable: true }],
        queryMode: "paged",
        defaultSettings: {
          viewMode: mode,
          columnGrouping: "none",
          rowGrouping: "none",
          displayProperties: ["summary"],
        },
        query: async (ctx, input) => {
          const { records, page } = await readPage(ctx.storage, input, "focus", count, summaryIndexFields);
          return {
            rows: records.map(({ fields }) => ({
              id: String(fields.id),
              title: String(fields.title),
              attributes: { summary: rowSummary(fields as unknown as SummaryFields) },
            })),
            page,
          };
        },
      },
    }),
  );
  const table = defineView({
    id: "records-table",
    title: "Paged records",
    body: {
      kind: "dataTable",
      queryMode: "paged",
      initialPageSize: 100,
      pageSizeOptions: [100],
      refreshEvents: [changed],
      columns: [{ id: "title", label: "Title", type: "string" }],
      query: async (ctx, input) => {
        const { records, page } = await readPage(ctx.storage, input, "pages", count, ["id", "title"]);
        return {
          rows: records.map(({ fields }) => ({ id: String(fields.id), values: { title: fields.title } })),
          page,
        };
      },
    },
  });
  const allViews = [...views, table];
  return {
    commands: [save],
    views: allViews,
    pages: allViews.map((view) =>
      definePage({
        id: view.id,
        title: view.title,
        path: view.id,
        mode: workbenchModes.project,
        main: { kind: "view", view: view.ref, cardinality: "one" },
        slots: [],
      }),
    ),
  };
};
