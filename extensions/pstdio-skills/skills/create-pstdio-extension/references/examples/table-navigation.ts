import {
  type DataTableRendererRowActivationHandler,
  definePage,
  defineResourceKind,
  defineView,
  l10n,
  workbenchModes,
} from "@pstdio/sdk/extensions";

// An explicit callback type breaks the inference cycle when a table targets its own page.
const note = defineResourceKind({ id: "note", label: "Note" });
const activate: DataTableRendererRowActivationHandler = (ctx, { row }) =>
  ctx.navigation.open({
    kind: "page",
    page: collection.ref,
    resource: row.resource,
  });
const table = defineView({
  id: "notes-table",
  title: l10n("notes.title", "Notes"),
  body: {
    kind: "dataTable",
    columns: [{ id: "title", label: "Title" }],
    query: () => ({ rows: [] }),
    onRowActivate: activate,
  },
});
const rootPage = definePage({
  id: "root",
  title: l10n("notes.title", "Notes"),
  path: "root",
  mode: workbenchModes.project,
  main: { kind: "panels" },
  slots: [],
});
const collection = definePage({
  parent: rootPage.ref,
  id: "notes-collection",
  title: l10n("notes.title", "Notes"),
  path: "notes-collection",
  mode: workbenchModes.project,
  resource: { kinds: [note.ref] },
  main: { kind: "view", view: table.ref, cardinality: "one" },
  slots: [],
});

export { collection, rootPage, table };
