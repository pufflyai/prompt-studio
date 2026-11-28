import type { ResourceRef } from "@pstdio/sdk/extensions";
import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { listDeployed } from "./deployed-controller";
import { projectDeployedMachineResource } from "./deployed-machine-resource";
import { dismissedDeployedMachineKey } from "./deployed-selection";
import { machineStateLabel } from "./machine-labels";
import { type ControllerMachine, isTerminal } from "./machines";

export interface DeployedMachineRow {
  id: string;
  name: string;
  state: ControllerMachine["state"];
  status: string;
  reason: string;
  template: string;
  version: string;
  createdAt: string;
  canStop: boolean;
  resource: ResourceRef;
}

export const listDeployedMachines = defineCommand({
  id: "deployed.machines-list",
  title: l10n("cloud-workspaces.list-deployed-workspaces", "List deployed workspaces"),
  cli: true,
  async run(ctx) {
    const machines = await listDeployed<ControllerMachine>(ctx.connections, "/v1/workspaces");
    const rows: DeployedMachineRow[] = [];
    for (const machine of machines) {
      if (await ctx.storage.get(dismissedDeployedMachineKey(machine.id))) continue;
      rows.push({
        id: machine.id,
        name: machine.external_id,
        state: machine.state,
        status: machineStateLabel(machine.state),
        reason: machine.reason_code ?? "",
        template: machine.template.name,
        version: machine.template.version,
        createdAt: machine.created_at,
        canStop: !isTerminal(machine) && machine.state !== "terminating",
        resource: projectDeployedMachineResource(ctx, machine),
      });
    }
    return { rows };
  },
});

export const deployedMachinesCommands = { "deployed.machines-list": listDeployedMachines };
