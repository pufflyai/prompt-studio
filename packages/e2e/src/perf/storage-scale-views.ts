import {
  defineCommand,
  definePage,
  defineView,
  type ExtensionStorageApi,
  eventRef,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import {
  compareRows,
  editOperation,
  type FixtureRow,
  matches,
  pageRows,
  rowSummary,
  type Workload,
  workload,
} from "storage-scale-fixture";

const readRows = async (storage: ExtensionStorageApi) =>
  (await storage.records.list()).filter((row) => !row.deleted).map((row) => row.value as FixtureRow);

// Ordinary public-API consumer views, using the existing native renderers and command form.
// They deliberately expose the legacy list baseline; no product performance UI is installed.
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
        defaultSettings: {
          viewMode: mode,
          columnGrouping: "none",
          rowGrouping: "none",
          displayProperties: ["summary"],
        },
        query: async (ctx) => ({
          rows: (await readRows(ctx.storage))
            .filter((row) => matches(row, "focus", count))
            .sort(compareRows)
            .map((row) => ({ id: row.id, title: row.title, attributes: { summary: rowSummary(row) } })),
        }),
      },
    }),
  );
  const table = defineView({
    id: "records-table",
    title: "Paged records",
    body: {
      kind: "dataTable",
      initialPageSize: 100,
      pageSizeOptions: [100],
      refreshEvents: [changed],
      columns: [{ id: "title", label: "Title", type: "string" }],
      query: async (ctx) => ({
        rows: (await readRows(ctx.storage))
          .filter((row) => matches(row, "pages", count))
          .sort(compareRows)
          .map((row) => ({ id: row.id, values: { title: row.title } })),
      }),
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
