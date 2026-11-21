import { setTimeout } from "node:timers/promises";
import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { instancesFor, PocketCoderHttpError } from "./instances";
import { isTerminal, type Machine, machinePath } from "./machines";
import { changed } from "./resources";

export function createMachineWatch(getInstances = instancesFor) {
  return defineCommand({
    id: "machines.watch",
    title: "Watch machine state",
    cli: true,
    automation: true,
    params: {
      instance: params.text({ label: "Instance ID", required: true }),
      machineId: params.text({ label: "Machine ID", required: true }),
    },
    async run(ctx, { instance, machineId }) {
      const instances = getInstances(ctx.projectId);
      const read = async <T>(path: string) => {
        while (true) {
          try {
            return await instances.request<T>(instance, path, { signal: ctx.signal });
          } catch (error) {
            if (ctx.signal.aborted) throw error;
            if (!(error instanceof TypeError) && !(error instanceof PocketCoderHttpError && error.status >= 500))
              throw error;
            await setTimeout(1_000, undefined, { signal: ctx.signal });
          }
        }
      };
      let machine = await read<Machine>(machinePath(machineId));
      await ctx.events.emit(changed, {});
      while (!isTerminal(machine)) {
        const change = await read<{ workspace: Machine; changed: boolean }>(
          `${machinePath(machineId)}/changes?after=${machine.change_cursor}&wait=30`,
        );
        machine = change.workspace;
        if (change.changed) await ctx.events.emit(changed, {});
      }
      return { machineId, state: machine.state };
    },
  });
}

export const watchMachine = createMachineWatch();

export async function ensureMachineWatch(ctx: ExtensionContextBase, instance: string, machine: Machine) {
  if (isTerminal(machine)) return;
  const key = `machine-watch:${instance}:${machine.id}`;
  const previousId = await ctx.storage.get<string>(key);
  const previous = previousId ? await ctx.automation.get(previousId) : undefined;
  if (previous && ["queued", "running"].includes(previous.status)) return;
  const run = await ctx.automation.enqueue({
    command: watchMachine.ref,
    input: { params: { instance, machineId: machine.id } },
    key: `${key}:${previous?.id ?? "first"}`,
  });
  await ctx.storage.set(key, run.id);
}
