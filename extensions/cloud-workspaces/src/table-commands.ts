import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { importTemplates } from "./commands";
import { catalogTemplateParam, publishTemplate } from "./instance-commands";
import { instancesFor } from "./instances";
import { connectMachine, deleteMachine, launchMachine } from "./machine-commands";
import { providerParams } from "./machines";
import { machineActionsSlot } from "./resources";

const instanceId = async (ctx: CommandContext) => {
  const id = ctx.resource?.type === "instance" ? ctx.resource.id : await ctx.storage.get<string>("selected-instance");
  if (!id) throw new Error("Choose a PocketCoder instance.");
  return id;
};
export const machineTarget = (ctx: Pick<CommandContext, "resource">) => {
  if (ctx.resource?.type !== "machine") throw new Error("Choose a PocketCoder machine.");
  const [instance, machineId] = ctx.resource.id.split(":");
  if (!instance || !machineId) throw new Error("Invalid PocketCoder machine reference.");
  return { instance, machineId };
};
export const selectedTemplateChoices = defineCommand({
  id: "templates.selected-choices",
  title: "List templates for this instance",
  cli: true,
  async run(ctx) {
    const templates = await instancesFor(ctx.projectId).items<{ name: string; version: string; status: string }>(
      await instanceId(ctx),
      "/v1/templates",
    );
    return templates
      .filter((template) => template.status === "active")
      .map((template) => ({
        value: `${template.name}@${template.version}`,
        label: `${template.name} (${template.version})`,
      }));
  },
});
export const launchSelectedMachine = defineCommand({
  id: "machines.launch-selected",
  title: "Launch machine",
  mutating: true,
  params: {
    template: params.select({
      label: "Agent template",
      required: true,
      options: { command: selectedTemplateChoices.ref, valueField: "value", labelField: "label" },
    }),
    externalId: providerParams.externalId,
    launchInput: providerParams.launchInput,
    metadata: providerParams.metadata,
  },
  async run(ctx, input) {
    return launchMachine.run(ctx, { ...input, instance: await instanceId(ctx) });
  },
});
export const importSelectedTemplates = defineCommand({
  id: "templates.import-selected",
  title: "Import templates",
  mutating: true,
  params: { directory: params.text({ label: "Prepared template folder", required: true }) },
  async run(ctx, input) {
    return importTemplates.run(ctx, { ...input, instance: await instanceId(ctx) });
  },
});
export const publishSelectedTemplate = defineCommand({
  id: "templates.publish-selected",
  title: "Add template",
  mutating: true,
  params: { template: catalogTemplateParam },
  async run(ctx, input) {
    return publishTemplate.run(ctx, { ...input, instance: await instanceId(ctx) });
  },
});
export const connectMachineRow = defineCommand({
  id: "machines.connect-row",
  title: "Connect to agent",
  menus: [{ slot: machineActionsSlot, icon: "messages-square", when: { metadata: { canConnect: true } } }],
  mutating: true,
  async run(ctx) {
    return connectMachine.run(ctx, machineTarget(ctx));
  },
});
export const deleteMachineRow = defineCommand({
  id: "machines.delete-row",
  title: "Delete machine",
  mutating: true,
  async run(ctx) {
    return deleteMachine.run(ctx, machineTarget(ctx));
  },
});
export const tableCommands = [
  selectedTemplateChoices,
  launchSelectedMachine,
  importSelectedTemplates,
  publishSelectedTemplate,
  connectMachineRow,
  deleteMachineRow,
];
