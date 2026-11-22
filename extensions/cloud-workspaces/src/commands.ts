import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { catalogChoices, launchInstance, publishTemplate, startInstance, stopInstance } from "./instance-commands";
import { removeInstance } from "./instance-removal";
import { instancesFor } from "./instances";
import { labCommands } from "./lab-commands";
import { connectMachine, deleteMachine, launchMachine } from "./machine-commands";
import { changed } from "./resources";
import { deleteTemplates, saveTemplate } from "./template-commands";

export const instanceChoices = defineCommand({
  id: "instances.choices",
  title: l10n("cloud-workspaces.list-running-pocketcoder-instances", "List running PocketCoder instances"),
  cli: true,
  async run(ctx) {
    return (await instancesFor(ctx.projectId).list())
      .filter((instance) => instance.state === "running")
      .map((instance) => ({ value: instance.id, label: instance.name }));
  },
});
const instanceParam = params.select({
  label: l10n("cloud-workspaces.pocketcoder-instance", "PocketCoder instance"),
  required: true,
  options: { command: instanceChoices.ref, valueField: "value", labelField: "label" },
});

export const templateChoices = defineCommand({
  id: "templates.choices",
  title: l10n("cloud-workspaces.list-agent-templates", "List agent templates"),
  cli: true,
  params: { instance: params.text({ label: l10n("cloud-workspaces.instance-id", "Instance ID"), required: true }) },
  async run(ctx, input) {
    const items = await instancesFor(ctx.projectId).items<{ name: string; version: string; status: string }>(
      input.instance,
      "/v1/templates",
    );
    return items
      .filter((item) => item.status === "active")
      .map((item) => ({ value: `${item.name}@${item.version}`, label: `${item.name} (${item.version})` }));
  },
});

export const importTemplates = defineCommand({
  id: "templates.import",
  title: l10n("cloud-workspaces.import-agent-templates", "Import agent templates"),
  cli: true,
  mutating: true,
  params: {
    instance: instanceParam,
    directory: params.text({
      label: l10n("cloud-workspaces.prepared-template-folder", "Prepared template folder"),
      required: true,
    }),
  },
  async run(ctx, input) {
    await instancesFor(ctx.projectId).importTemplates(input.instance, input.directory);
    await ctx.events.emit(changed, {});
    return { instanceId: input.instance };
  },
});

export const refresh = defineCommand({
  id: "refresh",
  title: l10n("cloud-workspaces.refresh", "Refresh Cloud Workspaces"),
  cli: true,
  async run(ctx) {
    await ctx.events.emit(changed, {});
    return {};
  },
});

export const commands = [
  ...Object.values(labCommands),
  saveTemplate,
  deleteTemplates,
  catalogChoices,
  instanceChoices,
  templateChoices,
  launchInstance,
  startInstance,
  stopInstance,
  removeInstance,
  importTemplates,
  publishTemplate,
  launchMachine,
  connectMachine,
  deleteMachine,
  refresh,
];
