import { defineView, l10n } from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { launchInstance, startInstance, stopInstance } from "./instance-commands";
import { removeInstance } from "./instance-removal";
import { instancesFor } from "./instances";
import { labCommands } from "./lab-commands";
import { projectMachineRow, readyMachineCheckpoint } from "./machine-row";
import { ensureMachineWatch } from "./machine-watch";
import type { ControllerMachine } from "./machines";
import { changed, instanceKind } from "./resources";
import { instanceRowId, selectionCommands } from "./selection-commands";
import {
  deleteMachineRow,
  importSelectedTemplates,
  launchSelectedMachine,
  publishSelectedTemplate,
} from "./table-commands";
import { openCatalog, saveTemplate } from "./template-commands";

const refreshAction = {
  id: "refresh",
  label: l10n("cloud-workspaces.refresh", "Refresh"),
  icon: "refresh-cw",
  command: refresh.ref,
};
const launchInstanceAction = {
  id: "launch-instance",
  label: l10n("cloud-workspaces.launch-instance", "Launch instance"),
  icon: "plus",
  command: launchInstance.ref,
  input: launchInstance.params,
  submitLabel: "Launch instance",
};

export const instancesView = defineView({
  id: "instances",
  title: l10n("cloud-workspaces.instances", "Instances"),
  icon: "server",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: l10n("cloud-workspaces.launch-a-pocketcoder-instance", "Launch a PocketCoder instance"),
    emptyDescription: l10n(
      "cloud-workspaces.save-a-template-then-launch-an-instance-with-the-local-executable",
      "Save a template, then launch an instance with the local executable.",
    ),
    toolbarActions: [
      launchInstanceAction,
      {
        id: "catalog",
        label: l10n("cloud-workspaces.template-catalog", "Template catalog"),
        icon: "package",
        command: openCatalog.ref,
      },
      refreshAction,
    ],
    columns: [
      { id: "name", label: l10n("cloud-workspaces.instance", "Instance") },
      { id: "state", label: l10n("cloud-workspaces.state", "State") },
      { id: "connection", label: l10n("cloud-workspaces.connection", "Connection") },
      { id: "url", label: l10n("cloud-workspaces.operator-api", "Operator API") },
      { id: "error", label: l10n("cloud-workspaces.error", "Error") },
    ],
    selectionMode: "multiple",
    selectionActions: [
      {
        id: "start",
        label: l10n("cloud-workspaces.start", "Start"),
        icon: "play",
        command: selectionCommands.startSelected.ref,
      },
      {
        id: "stop",
        label: l10n("cloud-workspaces.stop", "Stop"),
        icon: "square",
        command: selectionCommands.stopSelected.ref,
      },
      {
        id: "remove",
        label: l10n("cloud-workspaces.remove", "Remove"),
        icon: "trash-2",
        destructive: true,
        command: selectionCommands.removeSelected.ref,
      },
    ],
    rowActions: [
      {
        id: "open",
        label: l10n("cloud-workspaces.browse-instance", "Browse instance"),
        icon: "server",
        command: labCommands["lab.select"].ref,
      },
      {
        id: "start",
        label: l10n("cloud-workspaces.start-instance", "Start instance"),
        icon: "play",
        command: startInstance.ref,
      },
      {
        id: "stop",
        label: l10n("cloud-workspaces.stop-instance", "Stop instance"),
        icon: "square",
        command: stopInstance.ref,
      },
      {
        id: "remove",
        label: l10n("cloud-workspaces.remove-instance", "Remove instance"),
        icon: "trash-2",
        destructive: true,
        command: removeInstance.ref,
      },
    ],
    async query(ctx) {
      const instances = instancesFor(ctx.projectId);
      return {
        rows: await Promise.all(
          (await instances.list()).map(async (instance) => ({
            id: instance.id,
            resource: { type: instanceKind.id, id: instance.id, label: instance.name },
            values: {
              name: instance.name,
              state: instance.state,
              connection: await instances.connection(instance.id),
              url: instance.url,
              error: instance.error ?? "",
            },
          })),
        ),
      };
    },
    async onRowActivate(ctx, { row }) {
      await ctx.commands.execute(labCommands["lab.select"].ref, { params: { instance: row.id } });
    },
  },
});

export const templatesView = defineView({
  id: "templates",
  title: l10n("cloud-workspaces.templates", "Templates"),
  icon: "package",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: l10n("cloud-workspaces.no-published-templates", "No published templates"),
    emptyDescription: l10n(
      "cloud-workspaces.start-the-instance-then-add-a-catalog-template",
      "Start the instance, then add a catalog template.",
    ),
    toolbarActions: [
      {
        id: "add",
        label: l10n("cloud-workspaces.add-template", "Add template"),
        icon: "plus",
        presentation: "primary",
        command: publishSelectedTemplate.ref,
        input: publishSelectedTemplate.params,
        submitLabel: "Add template",
      },
      {
        id: "import",
        label: l10n("cloud-workspaces.import-templates", "Import templates"),
        icon: "package",
        command: importSelectedTemplates.ref,
        input: importSelectedTemplates.params,
        submitLabel: "Import templates",
      },
      {
        id: "save",
        label: l10n("cloud-workspaces.save-template", "Save template"),
        icon: "file-plus",
        command: saveTemplate.ref,
        input: saveTemplate.params,
        submitLabel: "Save template",
      },
      refreshAction,
    ],
    columns: [
      { id: "name", label: l10n("cloud-workspaces.template", "Template") },
      { id: "version", label: l10n("cloud-workspaces.version", "Version") },
      { id: "status", label: l10n("cloud-workspaces.status", "Status") },
      { id: "description", label: l10n("cloud-workspaces.description", "Description") },
    ],
    selectionMode: "multiple",
    selectionActions: [
      {
        id: "remove",
        label: l10n("cloud-workspaces.remove", "Remove"),
        icon: "trash-2",
        destructive: true,
        command: selectionCommands.retireSelectedTemplates.ref,
      },
    ],
    rowActions: [
      {
        id: "view",
        label: l10n("cloud-workspaces.view-template", "View template"),
        icon: "file-json",
        command: selectionCommands.viewPublishedTemplateRow.ref,
      },
      {
        id: "remove",
        label: l10n("cloud-workspaces.remove-template", "Remove template"),
        icon: "trash-2",
        destructive: true,
        command: selectionCommands.retireTemplateRow.ref,
      },
    ],
    async onRowActivate(ctx, { row }) {
      await ctx.commands.execute(selectionCommands.viewPublishedTemplateRow.ref, { params: { rowId: row.id } });
    },
    async query(ctx, { renderer }) {
      const id = renderer.resource?.id;
      if (!id) return { rows: [] };
      const instances = instancesFor(ctx.projectId);
      if ((await instances.get(id)).state !== "running") return { rows: [] };
      const templates = await instances.publishedTemplates(id);
      return {
        rows: templates.map((template) => ({
          id: instanceRowId(id, `${template.name}@${template.version}`),
          values: {
            name: template.name,
            version: template.version,
            status: template.status,
            description: template.description ?? "",
          },
        })),
      };
    },
  },
});
export const machinesView = defineView({
  id: "machines",
  title: l10n("cloud-workspaces.machines", "Machines"),
  icon: "bot",
  body: {
    kind: "dataTable",
    refreshEvents: [changed, "pocketcoder.pocketcoder.event.automation-run-changed"],
    emptyTitle: l10n("cloud-workspaces.no-machines-on-this-instance", "No machines on this instance"),
    emptyDescription: l10n(
      "cloud-workspaces.launch-a-machine-from-a-published-template-then-connect-when-it-is-ready",
      "Launch a machine from a published template, then connect when it is ready.",
    ),
    toolbarActions: [
      {
        id: "launch",
        label: l10n("cloud-workspaces.launch-machine", "Launch machine"),
        icon: "plus",
        presentation: "primary",
        command: launchSelectedMachine.ref,
        input: launchSelectedMachine.params,
        submitLabel: "Launch machine",
      },
      refreshAction,
    ],
    columns: [
      { id: "name", label: l10n("cloud-workspaces.machine", "Machine") },
      { id: "template", label: l10n("cloud-workspaces.template", "Template") },
      { id: "state", label: l10n("cloud-workspaces.state", "State") },
      { id: "createdAt", label: l10n("cloud-workspaces.created-at", "Created at"), type: "date" },
      { id: "runtime", label: l10n("cloud-workspaces.runtime", "Runtime") },
      { id: "recovery", label: l10n("cloud-workspaces.recovery", "Recovery") },
      { id: "error", label: l10n("cloud-workspaces.error", "Error") },
    ],
    selectionMode: "multiple",
    selectionActions: [
      {
        id: "delete",
        label: l10n("cloud-workspaces.delete", "Delete"),
        icon: "trash-2",
        destructive: true,
        command: selectionCommands.deleteSelectedMachines.ref,
      },
    ],
    rowActions: [
      {
        id: "delete",
        label: l10n("cloud-workspaces.delete-machine", "Delete machine"),
        icon: "trash-2",
        destructive: true,
        command: deleteMachineRow.ref,
      },
    ],
    async query(ctx, { renderer }) {
      const id = renderer.resource?.id;
      if (!id) return { rows: [] };
      const instances = instancesFor(ctx.projectId);
      if ((await instances.get(id)).state !== "running") return { rows: [] };
      const dismissed = new Set((await ctx.storage.get<string[]>(`dismissed-machines:${id}`)) ?? []);
      const machines = await instances.items<ControllerMachine>(id, "/v1/workspaces");
      const watches = await Promise.allSettled(
        machines.filter((machine) => !dismissed.has(machine.id)).map((machine) => ensureMachineWatch(ctx, id, machine)),
      );
      for (const watch of watches)
        if (watch.status === "rejected") ctx.logger.warn(`Machine state watch failed: ${String(watch.reason)}`);
      return {
        rows: await Promise.all(
          machines
            .filter((machine) => !dismissed.has(machine.id))
            .map(async (machine) =>
              projectMachineRow(id, machine, await readyMachineCheckpoint(instances, id, machine)),
            ),
        ),
      };
    },
  },
});
