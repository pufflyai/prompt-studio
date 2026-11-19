import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { createInstanceCommands } from "./instance-commands";
import { createRemoveInstance } from "./instance-removal";
import { instancesFor } from "./instances";
import { templateTarget } from "./lab-navigation";
import { createMachineCommands } from "./machine-commands";
import { changed } from "./resources";
import { catalogFiles, catalogPathFor } from "./template-catalog";

// Selection actions only receive row IDs, not the page's instance, so instance-scoped rows
// use "<instance id>:<row key>" as their ID.
export const instanceRowId = (instanceId: string, key: string) => `${instanceId}:${key}`;
const instanceRow = (rowId: string) => {
  const separator = rowId.indexOf(":");
  if (separator < 1) throw new Error(`Invalid PocketCoder row: ${rowId}.`);
  return { instance: rowId.slice(0, separator), key: rowId.slice(separator + 1) };
};
const templateRow = (rowId: string) => {
  const { instance, key } = instanceRow(rowId);
  const separator = key.lastIndexOf("@");
  if (separator < 1) throw new Error(`Invalid PocketCoder template row: ${rowId}.`);
  return { instance, name: key.slice(0, separator), version: key.slice(separator + 1) };
};

// Every selected row is tried, so one failure does not leave the rest of the selection untouched.
async function forEachRow(rowIds: string[], run: (rowId: string) => unknown) {
  const results = await Promise.allSettled(rowIds.map(async (rowId) => run(rowId)));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected" ? [`${rowIds[index]}: ${String(result.reason?.message ?? result.reason)}`] : [],
  );
  if (failures.length > 0)
    throw new Error(`${failures.length} of ${rowIds.length} selected rows failed.\n${failures.join("\n")}`);
  return { rowIds };
}

const rowIdsParam = { rowIds: params.list({ label: "Selected rows", required: true }) };
const rowIdParam = { rowId: params.text({ label: "Row", required: true }) };

export function createSelectionCommands(getInstances = instancesFor) {
  const { startInstance, stopInstance } = createInstanceCommands(getInstances);
  const removeInstance = createRemoveInstance(getInstances);
  const { deleteMachine } = createMachineCommands(getInstances);
  const retire = async (ctx: CommandContext, rowId: string) => {
    const { instance, name, version } = templateRow(rowId);
    await getInstances(ctx.projectId).retire(instance, name, version);
    await ctx.events.emit(changed, {});
  };
  const selected = (id: string, title: string, run: (ctx: CommandContext, rowId: string) => unknown) =>
    defineCommand({
      id,
      title,
      mutating: true,
      params: rowIdsParam,
      async run(ctx, input) {
        return forEachRow(input.rowIds, (rowId) => run(ctx, rowId));
      },
    });
  return {
    startSelected: selected("instances.start-selected", "Start instances", (ctx, instanceId) =>
      startInstance.run(ctx, { instanceId }),
    ),
    stopSelected: selected("instances.stop-selected", "Stop instances", (ctx, instanceId) =>
      stopInstance.run(ctx, { instanceId }),
    ),
    removeSelected: selected("instances.remove-selected", "Remove instances", (ctx, instanceId) =>
      removeInstance.run(ctx, { instanceId }),
    ),
    deleteSelectedMachines: selected("machines.delete-selected", "Delete machines", (ctx, rowId) => {
      const { instance, key } = instanceRow(rowId);
      return deleteMachine.run(ctx, { instance, machineId: key });
    }),
    retireSelectedTemplates: selected("templates.retire-selected", "Remove templates", retire),
    retireTemplateRow: defineCommand({
      id: "templates.retire-row",
      title: "Remove template",
      mutating: true,
      params: rowIdParam,
      async run(ctx, input) {
        await retire(ctx, input.rowId);
        return { rowId: input.rowId };
      },
    }),
    viewPublishedTemplateRow: defineCommand({
      id: "templates.view-published-row",
      title: "View template",
      params: rowIdParam,
      async run(ctx, input) {
        const { name, version } = templateRow(input.rowId);
        // The controller shares only safe template metadata, so the manifest comes from the project catalog.
        const path = await catalogPathFor(catalogFiles(ctx), name, version);
        ctx.navigation.open(templateTarget(ctx.projectId, path));
        return { path };
      },
    }),
  };
}

export const selectionCommands = createSelectionCommands();
