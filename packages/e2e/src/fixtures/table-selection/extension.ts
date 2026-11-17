import { defineCommand, defineExtension, definePage, defineView, params, workbenchModes } from "@pstdio/sdk/extensions";

const archive = defineCommand({
  id: "archive",
  title: "Archive tasks",
  params: { rowIds: params.list({ label: "Tasks", required: true }) },
  run(ctx, input) {
    ctx.notify.toast({ type: "success", message: `Archived ${input.rowIds.join(", ")}` });
    return input.rowIds;
  },
});
// Without queryMode "paged", the table owns its rows, selection and paging.
const table = defineView({
  id: "tasks",
  title: "Tasks",
  body: {
    kind: "dataTable",
    columns: [{ id: "title", label: "Title" }],
    selectionMode: "multiple",
    selectionActions: [{ id: "archive", label: "Archive", command: archive.ref }],
    query: () => ({
      rows: [
        { id: "alpha", values: { title: "Alpha" } },
        { id: "beta", values: { title: "Beta" } },
      ],
    }),
  },
});
const page = definePage({
  id: "tasks",
  title: "Tasks",
  path: "tasks",
  mode: workbenchModes.project,
  main: { kind: "view", view: table.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({ commands: [archive], views: [table], pages: [page] });
