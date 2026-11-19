import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { getDeployed } from "./deployed-controller";
import { stopDeployedWorkspaceWorker } from "./deployed-machine";
import { type ControllerMachine, isTerminal, machinePath } from "./machines";
import { changed, deployedMachineActionsSlot, deployedMachineKind } from "./resources";

export const dismissedDeployedMachineKey = (id: string) => `dismissed-deployed-machine:${id}`;

export const deployedSelectionWorker = defineCommand({
  id: "deployed.machines-selected-worker",
  title: "Update selected machines in background",
  automation: true,
  params: {
    rowIds: params.list({ label: "Selected machines", required: true }),
    remove: params.boolean({ label: "Remove from Cloud Workspaces", default: false }),
  },
  async run(ctx, { rowIds, remove }) {
    const results = await Promise.allSettled(
      rowIds.map(async (machineId) => {
        const machine = await getDeployed<ControllerMachine>(ctx.connections, machinePath(machineId), ctx.signal);
        if (!isTerminal(machine)) await stopDeployedWorkspaceWorker.run(ctx, { machineId });
        if (remove) {
          await ctx.storage.set(dismissedDeployedMachineKey(machineId), true);
          await ctx.resources.removed({
            type: deployedMachineKind.id,
            id: machineId,
            extensionId: ctx.extensionId,
            projectId: ctx.projectId,
          });
        }
        await ctx.events.emit(changed, {});
      }),
    );
    const failures = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${rowIds[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
        : [],
    );
    if (failures.length) {
      const message = `${failures.length} of ${rowIds.length} selected machines failed.\n${failures.join("\n")}`;
      await ctx.notify.action({ title: "Could not update every machine", body: message, kind: "failed" });
      throw new Error(message);
    }
    return { rowIds, removed: Boolean(remove) };
  },
});

async function queueSelection(ctx: CommandContext, rowIds: string[], remove: boolean) {
  const ids = [...new Set(rowIds)];
  if (!ids.length) throw new Error("Select at least one machine.");
  const run = await ctx.automation.enqueue({
    command: deployedSelectionWorker.ref,
    input: { params: { rowIds: ids, remove } },
    key: `deployed-selection:${crypto.randomUUID()}`,
  });
  return { rowIds: ids, runId: run.id };
}

export const stopDeployedMachines = defineCommand({
  id: "deployed.machines-stop-selected",
  title: "Stop selected machines",
  mutating: true,
  params: {
    rowIds: params.list({ label: "Selected machines", required: true }),
    confirmed: params.boolean({ label: "Confirm stop", default: false }),
  },
  confirmation: {
    kind: "delete",
    confirmedParam: "confirmed",
    description: "This stops the selected machines and any apps or tests running inside them.",
    buttonLabel: "Stop selected",
  },
  async run(ctx, { rowIds, confirmed }) {
    if (!confirmed) throw new Error("Confirm that you want to stop the selected machines.");
    return queueSelection(ctx, rowIds, false);
  },
});

export const deleteDeployedMachines = defineCommand({
  id: "deployed.machines-delete-selected",
  title: "Delete selected machines",
  mutating: true,
  params: {
    rowIds: params.list({ label: "Selected machines", required: true }),
    confirmed: params.boolean({ label: "Confirm delete", default: false }),
  },
  confirmation: {
    kind: "delete",
    confirmedParam: "confirmed",
    description: "This stops the selected machines and removes their rows from Cloud Workspaces.",
    buttonLabel: "Delete selected",
  },
  async run(ctx, { rowIds, confirmed }) {
    if (!confirmed) throw new Error("Confirm that you want to delete the selected machines.");
    return queueSelection(ctx, rowIds, true);
  },
});

export const deleteDeployedMachine = defineCommand({
  id: "deployed.machine-delete",
  title: "Delete machine",
  mutating: true,
  menus: [{ slot: deployedMachineActionsSlot, icon: "trash-2" }],
  params: { confirmed: params.boolean({ label: "Confirm delete", default: false }) },
  confirmation: {
    kind: "delete",
    confirmedParam: "confirmed",
    description: "This stops the machine and removes its row from Cloud Workspaces.",
    buttonLabel: "Delete machine",
  },
  async run(ctx, { confirmed }) {
    if (ctx.resource?.type !== deployedMachineKind.id) throw new Error("Choose a deployed machine.");
    if (!confirmed) throw new Error("Confirm that you want to delete this machine.");
    return queueSelection(ctx, [ctx.resource.id], true);
  },
});

export const deployedSelectionCommands = [
  deployedSelectionWorker,
  stopDeployedMachines,
  deleteDeployedMachines,
  deleteDeployedMachine,
];
