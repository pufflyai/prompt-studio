import { defineCommand, defineExtension, definePage, defineView, params, workbenchModes } from "@pstdio/sdk/extensions";

const choices = defineCommand({
  id: "choices",
  title: "Find locales",
  params: { search: params.text() },
  run: (_ctx, { search }) =>
    ["German", "French", "Spanish", "Italian", "Dutch", "Polish"]
      .filter((name) => !search || name.toLowerCase().includes(search.toLowerCase()))
      .map((name) => ({ id: name, name })),
});
const input = {
  search: params.text({ label: "Search locales" }),
  locale: params.select({
    required: true,
    options: {
      command: choices.ref,
      valueField: "id",
      labelField: "name",
      params: { search: params.valueOf("search") },
    },
  }),
};
const choose = defineCommand({ id: "choose", title: "Choose locale", params: input, run: (_ctx, values) => values });
const view = defineView({
  id: "list",
  title: "Locales",
  body: {
    kind: "dataTable",
    query: () => ({ rows: [] }),
    toolbarActions: [{ id: "choose", label: "Choose locale", command: choose.ref, input }],
  },
});
const page = definePage({
  id: "list",
  title: "Locales",
  path: "locales",
  mode: workbenchModes.project,
  main: { kind: "view", view: view.ref, cardinality: "one" },
  slots: [],
});
export default defineExtension({ commands: [choices, choose], views: [view], pages: [page] });
