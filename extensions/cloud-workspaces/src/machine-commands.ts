import { randomUUID } from "node:crypto";
import { commandRef, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { instancesFor } from "./instances";
import { machineConnection } from "./machine-connection";
import { dismissMachine } from "./machine-dismissals";
import { readyMachineCheckpoint } from "./machine-row";
import {
  attachMachineSession,
  checkRelayDevice,
  createMachineSession,
  machineConversationToAttach,
  machineSessionTarget,
  previousMachineSession,
} from "./machine-session";
import { unavailableMachineMessage } from "./machine-status";
import { type ControllerMachine, isTerminal, launchInputOf, machinePath, providerParams } from "./machines";
import { changed } from "./resources";

const ref = (id: string) => commandRef({ extensionId: "pocketcoder.pocketcoder", id });
const machineParams = {
  instance: params.text({ label: l10n("cloud-workspaces.instance-id", "Instance ID"), required: true }),
  machineId: params.text({ label: l10n("cloud-workspaces.machine-id", "Machine ID"), required: true }),
};

export function createMachineCommands(getInstances = instancesFor) {
  const launchMachine = defineCommand({
    id: "machines.launch",
    title: l10n("cloud-workspaces.launch-agent-machine", "Launch agent machine"),
    cli: true,
    mutating: true,
    params: {
      instance: params.select({
        label: l10n("cloud-workspaces.pocketcoder-instance", "PocketCoder instance"),
        required: true,
        options: { command: ref("instances.choices"), valueField: "value", labelField: "label" },
      }),
      template: params.select({
        label: l10n("cloud-workspaces.agent-template", "Agent template"),
        required: true,
        options: {
          command: ref("templates.choices"),
          valueField: "value",
          labelField: "label",
          params: { instance: params.valueOf("instance") },
        },
      }),
      externalId: providerParams.externalId,
      launchInput: providerParams.launchInput,
      metadata: providerParams.metadata,
    },
    async run(ctx, input) {
      const separator = input.template.lastIndexOf("@");
      if (separator < 1) throw new Error("Choose a versioned agent template.");
      const metadata = launchInputOf(input.metadata) ?? {};
      const machine = await getInstances(ctx.projectId).request<ControllerMachine>(input.instance, "/v1/workspaces", {
        method: "POST",
        headers: { "Idempotency-Key": randomUUID() },
        body: JSON.stringify({
          external_id: input.externalId || randomUUID(),
          template: { name: input.template.slice(0, separator), version: input.template.slice(separator + 1) },
          launch_input: launchInputOf(input.launchInput),
          metadata,
        }),
      });
      await ctx.events.emit(changed, {});
      return { instanceId: input.instance, machineId: machine.id };
    },
  });
  const connectMachine = defineCommand({
    id: "machines.connect",
    title: l10n("cloud-workspaces.connect-to-agent", "Connect to agent"),
    cli: true,
    mutating: true,
    params: machineParams,
    async run(ctx, input) {
      const instances = getInstances(ctx.projectId);
      const machine = await instances.request<ControllerMachine>(input.instance, machinePath(input.machineId));
      await ctx.events.emit(changed, {});
      const checkpoint =
        machine.state === "ready" ? null : await readyMachineCheckpoint(instances, input.instance, machine);
      const unavailable = unavailableMachineMessage(machine, checkpoint);
      if (unavailable) throw new Error(unavailable);
      const connection = await machineConnection(
        () => instances.request(input.instance, `${machinePath(machine.id)}/requests/capabilities`),
        machine.metadata,
      );
      const key = `machine-session:${input.instance}:${machine.id}`;
      let sessionId = await ctx.storage.get<string>(key);
      if (!sessionId && connection.kind === "session")
        sessionId = await previousMachineSession(ctx, input.instance, machine.id);
      if (connection.kind === "relay") await checkRelayDevice(ctx, connection.deviceId);
      const existing = sessionId ? await ctx.sessions.get(sessionId) : null;
      const conversationId =
        connection.kind === "session"
          ? await machineConversationToAttach(instances, input.instance, machine, existing)
          : undefined;
      const session =
        existing ?? (await createMachineSession(ctx, input.instance, machine, connection, conversationId));
      if (existing && conversationId)
        await attachMachineSession(ctx, existing.id, input.instance, machine.id, conversationId);
      if (connection.kind === "session")
        await instances.bindSession(session.id, input.instance, machine.id, conversationId);
      await ctx.storage.set(key, session.id);
      ctx.navigation.open(machineSessionTarget(ctx.projectId, session));
      return { machineId: machine.id, sessionId: session.id };
    },
  });
  const deleteMachine = defineCommand({
    id: "machines.delete",
    title: l10n("cloud-workspaces.delete-machine", "Delete machine"),
    cli: true,
    mutating: true,
    params: machineParams,
    async run(ctx, input) {
      const instances = getInstances(ctx.projectId);
      let machine = await instances.request<ControllerMachine>(input.instance, machinePath(input.machineId), {
        signal: ctx.signal,
      });
      if (!isTerminal(machine))
        machine = await instances.request(input.instance, `${machinePath(machine.id)}/cancel`, {
          method: "POST",
          signal: ctx.signal,
        });
      // Canceling the command stops this wait; the controller still finishes the cancellation it accepted.
      while (!isTerminal(machine)) {
        const change = await instances.request<{ workspace: ControllerMachine }>(
          input.instance,
          `${machinePath(machine.id)}/changes?after=${machine.change_cursor}&wait=30`,
          { signal: ctx.signal },
        );
        machine = change.workspace;
      }
      await dismissMachine(ctx, input.instance, machine.id);
      await ctx.events.emit(changed, {});
      return { machineId: machine.id, state: machine.state };
    },
  });
  return { launchMachine, connectMachine, deleteMachine };
}

export const { launchMachine, connectMachine, deleteMachine } = createMachineCommands();
