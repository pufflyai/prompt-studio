import { defineCommand, defineExtension, definePage, defineView, params, workbenchModes } from "@pstdio/sdk/extensions";

const regions = defineCommand({
  id: "regions",
  title: "List regions",
  run: () => [
    { id: "eu", name: "Europe" },
    { id: "us", name: "America" },
    { id: "empty", name: "Empty" },
    { id: "error", name: "Error" },
  ],
});
let failed = false;
const locales = defineCommand({
  id: "locales",
  title: "List locales",
  params: { region: params.text() },
  run: async (_context, { region }) => {
    if (region === "error" && !failed) {
      failed = true;
      throw new Error("Options unavailable");
    }
    if (region === "empty") return [];
    await new Promise((resolve) => setTimeout(resolve, region === "eu" ? 300 : 20));
    return region === "us" ? [{ id: "en", name: "English" }] : [{ id: "de", name: "German" }];
  },
});
const input = {
  tags: params.multiSelect({
    label: "Tags",
    allowCustomValues: true,
    defaultValue: ["a,b"],
    options: [{ value: "known", label: "Known tag" }],
  }),
  region: params.select({ required: true, options: { command: regions.ref, valueField: "id", labelField: "name" } }),
  locale: params.select({
    required: true,
    options: {
      command: locales.ref,
      valueField: "id",
      labelField: "name",
      params: { region: params.valueOf("region") },
    },
  }),
};
const run = defineCommand({
  id: "run",
  title: "Run experiment",
  params: { ...input, source: params.text() },
  run: async (context, values) => {
    await context.notify.toast({
      type: "success",
      title: "Experiment started",
      message: `${values.source}: ${values.region}/${values.locale} ${JSON.stringify(values.tags)}`,
    });
    return values;
  },
});
const toolbarActions = [
  {
    id: "run",
    label: "Run experiment",
    command: run.ref,
    presentation: "primary" as const,
    params: { source: "toolbar" },
    input,
    submitLabel: "Start experiment",
  },
  { id: "disabled", label: "Disabled experiment", command: run.ref, disabled: true },
  { id: "hidden", label: "Hidden experiment", command: run.ref, when: "neverEnabled" },
];
const table = defineView({
  id: "table",
  title: "Experiments",
  body: { kind: "dataTable", toolbarActions, query: () => ({ rows: [] }) },
});
const board = defineView({
  id: "board",
  title: "Experiments board",
  body: { kind: "kanban", toolbarActions, query: () => ({ rows: [] }) },
});
const pages = [table, board].map((view) =>
  definePage({
    id: view.id,
    title: view.title,
    path: view.id,
    mode: workbenchModes.project,
    main: { kind: "view", view: view.ref, cardinality: "one" },
    slots: [],
  }),
);
export default defineExtension({ commands: [regions, locales, run], views: [table, board], pages });
