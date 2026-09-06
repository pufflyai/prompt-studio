const commandFile = (body: string) => `import {
  defineCommand,
  defineExtension,
  params,
} from "@pstdio/sdk/extensions";

${body}

export default defineExtension({ commands: [command] });`;

export const commandParamsSources = {
  number: commandFile(`const command = defineCommand({
  id: "bump-counter",
  title: "Bump counter",
  params: {
    amount: params.number({ label: "Amount", defaultValue: 1 }),
  },
  async run(ctx, commandParams) {
    await ctx.storage.set("counter", commandParams.amount);
  },
});`),
  refineTicket: commandFile(`const command = defineCommand({
  id: "refine-ticket",
  title: "Refine ticket",
  params: {
    template: params.template({
      type: "ticket",
      label: "Template",
      required: false,
    }),
    context: params.longText({
      label: "Additional context",
      required: false,
    }),
  },
  async run(_ctx, commandParams) {
    return commandParams;
  },
});`),
  everyControl: commandFile(`const command = defineCommand({
  id: "all-parameters",
  title: "Run with every parameter type",
  params: {
    title: params.text({ label: "Title", required: true }),
    mode: params.select({
      label: "Mode",
      defaultValue: "worktree",
      options: [
        { label: "Worktree", value: "worktree" },
        { label: "Current branch", value: "current_branch" },
      ],
    }),
    labels: params.multiSelect({
      label: "Labels",
      options: [
        { label: "Bug", value: "bug" },
        { label: "Feature", value: "feature" },
      ],
    }),
    attempts: params.number({ label: "Attempts", defaultValue: 2 }),
    draft: params.boolean({ label: "Open as draft" }),
    notes: params.longText({ label: "Notes" }),
  },
  async run(ctx, commandParams) {
    await ctx.storage.set("last-run", commandParams);
  },
});`),
  files: commandFile(`const command = defineCommand({
  id: "import-data",
  title: "Import data files",
  params: {
    files: params.files({
      label: "Data files",
      description: "Choose one or more CSV files to import.",
      required: true,
      multiple: true,
      accept: ".csv",
    }),
  },
  async run(ctx, commandParams) {
    await ctx.storage.set("last-import", commandParams.files);
  },
});`),
} as const;
