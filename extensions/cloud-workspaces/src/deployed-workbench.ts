import { defineCommand, defineView, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { deployedName, deployedStatus, listDeployed } from "./deployed-controller";
import type { LabTemplate } from "./lab-model";
import { deployedInstanceTarget } from "./lab-navigation";
import { machineStateLabel } from "./machine-status";
import type { ControllerMachine } from "./machines";
import { changed } from "./resources";

export const openDeployed = defineCommand({
  id: "deployed.open",
  title: l10n("cloud-workspaces.browse-deployed-pocketcoder-instance", "Browse deployed PocketCoder instance"),
  cli: true,
  async run(ctx) {
    const name = deployedName(await ctx.settings.all());
    ctx.navigation.open(deployedInstanceTarget(ctx, name));
    return { name };
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
    kind: "webview",
    entry: packageAsset("./deployed-machines-webview.tsx", import.meta.url),
    capabilities: ["commands.query", "commands.execute", "navigation.open"],
  },
});
