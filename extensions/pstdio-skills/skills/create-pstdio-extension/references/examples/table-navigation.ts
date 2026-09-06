import {
  type DataTableRendererRowActivationHandler,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
  workbenchPages,
} from "@pstdio/sdk/extensions";

// An explicit callback type breaks the inference cycle when a table targets its own page.
const note = defineResourceKind({ id: "note", label: "Note" });
const activate: DataTableRendererRowActivationHandler = (_ctx, { row }) => ({
  kind: "page",
  page: collection.ref,
  resource: row.resource,
});
const table = defineView({
  id: "notes-table",
  title: "Notes",
  body: {
    kind: "dataTable",
    columns: [{ id: "title", label: "Title" }],
    query: () => ({ rows: [] }),
    onRowActivate: activate,
  },
});
const collection = definePage({
  id: "notes-collection",
  title: "Notes",
  path: "notes-collection",
  mode: workbenchModes.project,
  resource: { kinds: [note.ref] },
  parent: workbenchPages.start,
  main: { kind: "view", view: table.ref, cardinality: "one" },
  slots: [],
});

export { collection, table };
