import { type CommandContext, commandRef, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { resolveExecutable } from "./executable";
import { instancesFor } from "./instances";
import { isTerminal, type Machine } from "./machines";
import { changed } from "./resources";
import { catalogFiles, listCatalog, selectedTemplate } from "./template-catalog";

const ref = (id: string) => commandRef({ extensionId: "pocketcoder.pocketcoder", id });
const binaryParam = params.text({
  label: l10n("cloud-workspaces.pocketcoder-executable-optional", "PocketCoder executable (optional)"),
  description: l10n(
    "cloud-workspaces.defaults-to-this-project-s-out-native-pocketcoder-then-path",
    "Defaults to this project's out/native/pocketcoder, then PATH.",
  ),
});
const catalogOptions = { command: ref("templates.catalog"), valueField: "value", labelField: "label" };
export const catalogTemplateParam = params.select({
  label: l10n("cloud-workspaces.agent-template", "Agent template"),
  required: true,
  options: catalogOptions,
});
const projectRoot = async (ctx: CommandContext) => {
  const workspace = await ctx.workspaces.getDefault();
  return workspace?.rootPath ?? workspace?.root_path ?? undefined;
};

export function createInstanceCommands(getInstances = instancesFor) {
  const catalogChoices = defineCommand({
    id: "templates.catalog",
    title: l10n("cloud-workspaces.list-project-agent-templates", "List project agent templates"),
    cli: true,
    async run(ctx) {
      return (await listCatalog(catalogFiles(ctx))).flatMap(({ template }) =>
        template
          ? [
              {
                value: template.path,
                label: `${template.name} (${template.version}) — ${template.path.split("/").pop()}`,
              },
            ]
          : [],
      );
    },
  });
  const launchInstance = defineCommand({
    id: "instances.launch",
    title: l10n("cloud-workspaces.launch-pocketcoder-instance", "Launch PocketCoder instance"),
    cli: true,
    mutating: true,
    palette: [
      {
        group: "Cloud Workspaces",
        label: l10n("cloud-workspaces.launch-pocketcoder-instance", "Launch PocketCoder instance"),
      },
    ],
    params: {
      name: params.text({ label: l10n("cloud-workspaces.instance-name", "Instance name"), required: true }),
      binary: binaryParam,
      templates: params.multiSelect({
        label: l10n("cloud-workspaces.agent-templates", "Agent templates"),
        required: true,
        options: catalogOptions,
      }),
    },
    async run(ctx, input) {
      const files = catalogFiles(ctx);
      const templates = await Promise.all(input.templates.map((path) => selectedTemplate(files, path)));
      const instance = await getInstances(ctx.projectId).launch(
        {
          name: input.name,
          binary: input.binary,
          projectRoot: await projectRoot(ctx),
          manifests: templates.map((template) => template.manifest),
        },
        () => ctx.net.findFreePort({ host: "0.0.0.0" }),
      );
      await ctx.events.emit(changed, {});
      return instance;
    },
  });
  const publishTemplate = defineCommand({
    id: "templates.publish",
    title: l10n("cloud-workspaces.add-template-to-instance", "Add template to instance"),
    cli: true,
    mutating: true,
    params: {
      instance: params.select({
        label: l10n("cloud-workspaces.pocketcoder-instance", "PocketCoder instance"),
        required: true,
        options: { command: ref("instances.choices"), valueField: "value", labelField: "label" },
      }),
      template: catalogTemplateParam,
    },
    async run(ctx, input) {
      const template = await selectedTemplate(catalogFiles(ctx), input.template);
      await getInstances(ctx.projectId).publish(input.instance, template.manifest);
      await ctx.events.emit(changed, {});
      return { instanceId: input.instance, template: `${template.name}@${template.version}` };
    },
  });
  const startInstance = defineCommand({
    id: "instances.start",
    title: l10n("cloud-workspaces.start-instance", "Start instance"),
    cli: true,
    mutating: true,
    params: {
      instanceId: params.text({ label: l10n("cloud-workspaces.instance-id", "Instance ID"), resolvedFrom: "resource" }),
      binary: binaryParam,
    },
    async run(ctx, input) {
      const instances = getInstances(ctx.projectId);
      const id = input.instanceId || (ctx.resource?.type === "instance" ? ctx.resource.id : undefined);
      if (!id) throw new Error("Choose a PocketCoder instance.");
      const binary = await resolveExecutable({
        binary: input.binary || (await instances.get(id)).binary,
        projectRoot: await projectRoot(ctx),
      });
      const instance = await instances.start(id, binary);
      await ctx.events.emit(changed, {});
      return instance;
    },
  });
  const stopInstance = defineCommand({
    id: "instances.stop",
    title: l10n("cloud-workspaces.stop-pocketcoder-instance", "Stop PocketCoder instance"),
    cli: true,
    mutating: true,
    params: {
      instanceId: params.text({ label: l10n("cloud-workspaces.instance-id", "Instance ID"), resolvedFrom: "resource" }),
    },
    async run(ctx, input) {
      const instances = getInstances(ctx.projectId);
      const instanceId = input.instanceId || (ctx.resource?.type === "instance" ? ctx.resource.id : undefined);
      if (!instanceId) throw new Error("Choose a PocketCoder instance.");
      const instance = await instances.get(instanceId);
      // A failed status check also reads as stopped, but the controller may still run.
      if (instance.error) throw new Error(instance.error);
      if (instance.state === "running") {
        const machines = await instances.items<Machine>(instanceId, "/v1/workspaces");
        if (machines.some((machine) => !isTerminal(machine)))
          throw new Error("Delete or cancel this instance's active machines before stopping it.");
        await instances.stop(instanceId);
      }
      await ctx.events.emit(changed, {});
      return { instanceId, state: "stopped" };
    },
  });
  return { catalogChoices, launchInstance, publishTemplate, startInstance, stopInstance };
}

export const { catalogChoices, launchInstance, publishTemplate, startInstance, stopInstance } =
  createInstanceCommands();
