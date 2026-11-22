import { randomUUID } from "node:crypto";
import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { instancesFor, PocketCoderHttpError } from "./instances";
import { type ControllerMachine, launchInputOf, machinePath, providerParams } from "./machines";
import { changed } from "./resources";

export const lifecycleInputParams = {
  externalId: providerParams.externalId,
  launchInput: providerParams.launchInput,
  metadata: providerParams.metadata,
};
const lifecycleParams = {
  instance: params.text({ label: l10n("cloud-workspaces.instance-id", "Instance ID"), required: true }),
  machineId: params.text({ label: l10n("cloud-workspaces.source-machine-id", "Source machine ID"), required: true }),
  ...lifecycleInputParams,
};

export function createMachineLifecycle(getInstances = instancesFor) {
  const relaunchMachine = defineCommand({
    id: "machines.relaunch",
    title: l10n("cloud-workspaces.relaunch-machine", "Relaunch machine"),
    cli: true,
    mutating: true,
    params: lifecycleParams,
    async run(ctx, input) {
      const instances = getInstances(ctx.projectId);
      const source = await instances.request<ControllerMachine>(input.instance, machinePath(input.machineId));
      const metadata = launchInputOf(input.metadata) ?? {};
      const machine = await instances.request<ControllerMachine>(input.instance, "/v1/workspaces", {
        method: "POST",
        headers: { "Idempotency-Key": randomUUID() },
        body: JSON.stringify({
          external_id: input.externalId || randomUUID(),
          template: { name: source.template.name, version: source.template.version },
          launch_input: launchInputOf(input.launchInput),
          metadata,
        }),
      });
      await ctx.events.emit(changed, {});
      return { instanceId: input.instance, machineId: machine.id };
    },
  });
  const resumeMachine = defineCommand({
    id: "machines.resume",
    title: l10n("cloud-workspaces.resume-machine", "Resume machine"),
    cli: true,
    mutating: true,
    params: { ...lifecycleParams, templateVersion: providerParams.templateVersion },
    async run(ctx, input) {
      const instances = getInstances(ctx.projectId);
      const metadata = launchInputOf(input.metadata) ?? {};
      let result: { workspace: ControllerMachine };
      try {
        result = await instances.request(input.instance, `${machinePath(input.machineId)}/resume`, {
          method: "POST",
          headers: { "Idempotency-Key": randomUUID() },
          body: JSON.stringify({
            external_id: input.externalId || randomUUID(),
            launch_input: launchInputOf(input.launchInput),
            metadata,
            template_version: input.templateVersion || undefined,
          }),
        });
      } catch (error) {
        if (error instanceof PocketCoderHttpError) {
          if (error.code === "checkpoint.none_ready")
            throw new Error("No ready checkpoint. Use Relaunch machine to start fresh with new launch input.");
          if (error.code === "resume.unsupported")
            throw new Error("This checkpoint cannot restore the conversation. Use Relaunch machine to start fresh.");
        }
        throw error;
      }
      await ctx.events.emit(changed, {});
      return { instanceId: input.instance, machineId: result.workspace.id };
    },
  });
  return { relaunchMachine, resumeMachine };
}

export const { relaunchMachine, resumeMachine } = createMachineLifecycle();
