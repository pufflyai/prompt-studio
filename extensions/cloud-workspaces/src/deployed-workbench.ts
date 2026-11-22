import { defineCommand, defineView, l10n } from "@pstdio/sdk/extensions";
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
  title: l10n("cloud-workspaces.browse-deployed-pocketcoder-instance", "Browse deployed PocketCoder instance"),
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
  title: l10n("cloud-workspaces.read-deployed-pocketcoder-instance", "Read deployed PocketCoder instance"),
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

const refreshActions = [
  { id: "refresh", label: l10n("cloud-workspaces.refresh", "Refresh"), icon: "refresh-cw", command: refresh.ref },
];

export const deployedInstancesView = defineView({
  id: "deployed-instances",
  title: l10n("cloud-workspaces.deployed-instance", "Deployed instance"),
  icon: "cloud",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    toolbarActions: refreshActions,
    columns: [
      { id: "name", label: l10n("cloud-workspaces.instance", "Instance") },
      { id: "state", label: l10n("cloud-workspaces.connection", "Connection") },
      { id: "error", label: l10n("cloud-workspaces.details", "Details") },
    ],
    rowActions: [
      {
        id: "open",
        label: l10n("cloud-workspaces.browse-instance", "Browse instance"),
        icon: "server",
        command: openDeployed.ref,
      },
    ],
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
  title: l10n("cloud-workspaces.templates", "Templates"),
  icon: "package",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: l10n("cloud-workspaces.no-visible-templates", "No visible templates"),
    toolbarActions: refreshActions,
    columns: [
      { id: "name", label: l10n("cloud-workspaces.template", "Template") },
      { id: "version", label: l10n("cloud-workspaces.version", "Version") },
      { id: "status", label: l10n("cloud-workspaces.status", "Status") },
      { id: "description", label: l10n("cloud-workspaces.description", "Description") },
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
  title: l10n("cloud-workspaces.machines", "Machines"),
  icon: "bot",
  body: {
    kind: "dataTable",
    refreshEvents: [changed, "pocketcoder.pocketcoder.event.automation-run-changed"],
    emptyTitle: l10n("cloud-workspaces.no-visible-machines", "No visible machines"),
    toolbarActions: [
      {
        id: "launch",
        label: l10n("cloud-workspaces.launch-workspace", "Launch workspace"),
        icon: "plus",
        presentation: "primary",
        command: launchDeployedWorkspace.ref,
        input: launchDeployedWorkspace.params,
        submitLabel: "Launch workspace",
      },
      ...refreshActions,
    ],
    columns: [
      { id: "name", label: l10n("cloud-workspaces.machine", "Machine") },
      { id: "template", label: l10n("cloud-workspaces.template", "Template") },
      { id: "state", label: l10n("cloud-workspaces.state", "State") },
      { id: "createdAt", label: l10n("cloud-workspaces.created-at", "Created at"), type: "date" },
      { id: "error", label: l10n("cloud-workspaces.reason", "Reason") },
    ],
    selectionMode: "multiple",
    selectionActions: [
      {
        id: "stop-selected",
        label: l10n("cloud-workspaces.stop-selected", "Stop selected"),
        icon: "square",
        command: stopDeployedMachines.ref,
      },
      {
        id: "delete-selected",
        label: l10n("cloud-workspaces.delete-selected", "Delete selected"),
        icon: "trash-2",
        destructive: true,
        command: deleteDeployedMachines.ref,
      },
    ],
    defaultSorts: [{ attributeId: "createdAt", direction: "desc" }],
    rowActions: [
      {
        id: "open",
        label: l10n("cloud-workspaces.open-workspace", "Open workspace"),
        icon: "bot",
        command: openDeployedMachine.ref,
      },
    ],
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
