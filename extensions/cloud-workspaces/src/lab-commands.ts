import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { instancesFor } from "./instances";
import type { LabSnapshot, LabTemplate } from "./lab-model";
import { instancesPageRef, instanceTarget } from "./lab-navigation";
import type { ControllerMachine } from "./machines";
import { changed } from "./resources";

export function createLabCommands(getInstances = instancesFor) {
  const read = defineCommand({
    id: "lab.read",
    title: l10n("cloud-workspaces.read", "Read Cloud Workspaces"),
    cli: true,
    async run(ctx): Promise<LabSnapshot> {
      const controller = getInstances(ctx.projectId);
      const instances = await controller.list();
      const saved = await ctx.storage.get<string>("selected-instance");
      const selected =
        instances.find((instance) => instance.id === saved) ??
        instances.find((instance) => instance.state === "running") ??
        instances[0];
      let machines: ControllerMachine[] = [];
      let templates: LabTemplate[] = [];
      let error: string | undefined;
      const dismissed = new Set(
        selected ? ((await ctx.storage.get<string[]>(`dismissed-machines:${selected.id}`)) ?? []) : [],
      );
      if (selected?.state === "running") {
        try {
          [machines, templates] = await Promise.all([
            controller.items<ControllerMachine>(selected.id, "/v1/workspaces"),
            controller.publishedTemplates(selected.id),
          ]);
        } catch (reason) {
          error = String(reason);
        }
      }
      return {
        error,
        instances: instances.map(({ id, name, state }) => ({ id, name, state })),
        selectedInstance: selected?.id ?? null,
        templates,
        machines: machines
          .filter((machine) => !dismissed.has(machine.id))
          .map((machine) => ({
            id: machine.id,
            name: machine.external_id,
            state: machine.state,
            createdAt: machine.created_at,
            template: `${machine.template.name}@${machine.template.version}`,
            error: machine.failure?.log_tail ?? machine.reason_code ?? "",
          })),
      };
    },
  });
  const select = defineCommand({
    id: "lab.select",
    title: "Select PocketCoder instance",
    cli: true,
    mutating: true,
    params: { instance: params.text({ label: "Instance ID", resolvedFrom: "resource" }) },
    async run(ctx, input) {
      const id = input.instance ?? (ctx.resource?.type === "instance" ? ctx.resource.id : undefined);
      if (!id) throw new Error("Choose a PocketCoder instance.");
      const instance = await getInstances(ctx.projectId).get(id);
      await ctx.storage.set("selected-instance", id);
      await ctx.events.emit(changed, {});
      ctx.navigation.open(instanceTarget(ctx.projectId, instance));
      return { instanceId: id };
    },
  });
  const open = defineCommand({
    id: "lab.open",
    title: l10n("cloud-workspaces.open", "Open Cloud Workspaces"),
    cli: true,
    async run(ctx) {
      const instances = await getInstances(ctx.projectId).list();
      const selected = await ctx.storage.get<string>("selected-instance");
      const instance =
        instances.find((instance) => instance.id === selected) ??
        instances.find((instance) => instance.state === "running");
      ctx.navigation.open(
        instance ? instanceTarget(ctx.projectId, instance) : { kind: "page", page: instancesPageRef },
      );
      return { instanceId: instance?.id ?? null };
    },
  });
  return { read, select, open };
}
const { read, select, open } = createLabCommands();
export const labCommands = { "lab.read": read, "lab.select": select, "lab.open": open };
