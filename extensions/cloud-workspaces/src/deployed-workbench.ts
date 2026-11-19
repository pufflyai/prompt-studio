import { defineCommand, defineView } from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { deployedConnection, deployedName, deployedStatus, listDeployed } from "./deployed-controller";
import { launchDeployedWorkspace } from "./deployed-launch";
import { openDeployedMachine } from "./deployed-machine";
import { canOpenDeployedPreview } from "./deployed-preview";
import { deleteDeployedMachines, dismissedDeployedMachineKey, stopDeployedMachines } from "./deployed-selection";
import type { LabTemplate } from "./lab-model";
import { deployedPageRef } from "./lab-navigation";
import { machineStateLabel } from "./machine-status";
import { type ControllerMachine, isTerminal } from "./machines";
import { changed, deployedMachineKind } from "./resources";

export const openDeployed = defineCommand({
  id: "deployed.open",
  title: "Browse deployed PocketCoder instance",
  cli: true,
  run(ctx) {
    ctx.navigation.open({ kind: "page", page: deployedPageRef });
    return {};
  },
});

const projectMachine = (machine: ControllerMachine) => ({
  id: machine.id,
  name: machine.external_id,
  template: `${machine.template.name}@${machine.template.version}`,
  state: machineStateLabel(machine.state),
  createdAt: machine.created_at,
  error: machine.reason_code ?? "",
});

export const readDeployed = defineCommand({
  id: "deployed.read",
  title: "Read deployed PocketCoder instance",
  cli: true,
  async run(ctx) {
    const name = deployedName(await ctx.settings.all());
    const status = await deployedStatus(ctx.connections);
    if (status.state !== "Connected") return { name, ...status, machines: [], templates: [] };
    const [machines, templates] = await Promise.all([
      listDeployed<ControllerMachine>(ctx.connections, "/v1/workspaces"),
      listDeployed<LabTemplate>(ctx.connections, "/v1/templates"),
    ]);
    return { name, ...status, machines: machines.map(projectMachine), templates };
  },
});

const refreshActions = [{ id: "refresh", label: "Refresh", icon: "refresh-cw", command: refresh.ref }];

export const deployedInstancesView = defineView({
  id: "deployed-instances",
  title: "Deployed instance",
  icon: "cloud",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    toolbarActions: refreshActions,
    columns: [
      { id: "name", label: "Instance" },
      { id: "state", label: "Connection" },
      { id: "error", label: "Details" },
    ],
    rowActions: [{ id: "open", label: "Browse instance", icon: "server", command: openDeployed.ref }],
    async query(ctx) {
      const [settings, status] = await Promise.all([ctx.settings.all(), deployedStatus(ctx.connections)]);
      return { rows: [{ id: deployedConnection.id, values: { name: deployedName(settings), ...status } }] };
    },
    async onRowActivate(ctx) {
      await ctx.commands.execute(openDeployed.ref, { params: {} });
    },
  },
});

export const deployedTemplatesView = defineView({
  id: "deployed-templates",
  title: "Templates",
  icon: "package",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: "No visible templates",
    toolbarActions: refreshActions,
    columns: [
      { id: "name", label: "Template" },
      { id: "version", label: "Version" },
      { id: "status", label: "Status" },
      { id: "description", label: "Description" },
    ],
    async query(ctx) {
      const templates = await listDeployed<LabTemplate>(ctx.connections, "/v1/templates");
      return {
        rows: templates.map(({ name, version, status, description }) => ({
          id: `${name}@${version}`,
          values: { name, version, status, description: description ?? "" },
        })),
      };
    },
  },
});

export const deployedMachinesView = defineView({
  id: "deployed-machines",
  title: "Machines",
  icon: "bot",
  body: {
    kind: "dataTable",
    refreshEvents: [changed, "pocketcoder.pocketcoder.event.automation-run-changed"],
    emptyTitle: "No visible machines",
    toolbarActions: [
      {
        id: "launch",
        label: "Launch workspace",
        icon: "plus",
        presentation: "primary",
        command: launchDeployedWorkspace.ref,
        input: launchDeployedWorkspace.params,
        submitLabel: "Launch workspace",
      },
      ...refreshActions,
    ],
    columns: [
      { id: "name", label: "Machine" },
      { id: "template", label: "Template" },
      { id: "state", label: "State" },
      { id: "createdAt", label: "Created at", type: "date" },
      { id: "error", label: "Reason" },
    ],
    selectionMode: "multiple",
    selectionActions: [
      { id: "stop-selected", label: "Stop selected", icon: "square", command: stopDeployedMachines.ref },
      {
        id: "delete-selected",
        label: "Delete selected",
        icon: "trash-2",
        destructive: true,
        command: deleteDeployedMachines.ref,
      },
    ],
    defaultSorts: [{ attributeId: "createdAt", direction: "desc" }],
    rowActions: [{ id: "open", label: "Open workspace", icon: "bot", command: openDeployedMachine.ref }],
    async onRowActivate(ctx, { row }) {
      await ctx.commands.execute(openDeployedMachine.ref, { params: { machineId: row.id } });
    },
    async query(ctx) {
      const machines = await listDeployed<ControllerMachine>(ctx.connections, "/v1/workspaces");
      const dismissed = new Set(
        await Promise.all(
          machines.map(async ({ id }) => ((await ctx.storage.get(dismissedDeployedMachineKey(id))) ? id : null)),
        ),
      );
      return {
        rows: machines
          .filter(({ id }) => !dismissed.has(id))
          .map((machine) => {
            const { id, ...values } = projectMachine(machine);
            return {
              id,
              resource: {
                type: deployedMachineKind.id,
                id,
                label: values.name,
                metadata: {
                  canStop: !isTerminal(machine) && machine.state !== "terminating",
                  canOpenPreview: canOpenDeployedPreview(machine),
                },
              },
              values,
            };
          }),
      };
    },
  },
});
