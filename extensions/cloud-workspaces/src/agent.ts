import {
  defineHarness,
  type HarnessContext,
  type HarnessStartInput,
  reconcileMessageHistory,
} from "@pstdio/sdk/extensions";
import { fileTurnMessages, reconnectFileTurn, resumeFileTurn, startFileTurn, supportsFileTurns } from "./file-turns";
import { createHarnessRuns } from "./harness-runs";
import { instancesFor } from "./instances";
import { isTerminal, type Machine, machinePath, machineRef } from "./machines";

export function createMachineHarness(getInstances = instancesFor) {
  const runs = createHarnessRuns();
  const target = async (
    ctx: HarnessContext,
    input: {
      workspace?: HarnessStartInput["workspace"];
      agentSessionId?: string;
      sessionId?: string;
    },
  ) => {
    const execution = input.workspace?.executionTarget;
    if (!ctx.projectId) throw new Error("Choose a PocketCoder project.");
    const instances = getInstances(ctx.projectId);
    let ref: { instanceId: string; machineId: string; conversationId?: string };
    if (execution?.kind === "remote" && execution.providerId === `${ctx.extensionId}.workspace-type.machine`) {
      ref = machineRef(execution.providerRef);
    } else if (input.sessionId) {
      ref = await instances.sessionTarget(input.sessionId).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        const [instanceId, machineId] = input.agentSessionId?.split(":") ?? [];
        if (!instanceId || !machineId) throw new Error("Choose a PocketCoder machine.");
        return { instanceId, machineId };
      });
    } else if (input.agentSessionId) {
      const [instanceId, machineId] = input.agentSessionId.split(":");
      if (!instanceId || !machineId) throw new Error("Invalid PocketCoder agent session.");
      ref = { instanceId, machineId };
    } else throw new Error("Choose a PocketCoder agent machine.");
    const sessionId = `${ref.instanceId}:${ref.machineId}`;
    if (input.agentSessionId && input.agentSessionId !== sessionId && !input.agentSessionId.startsWith(`${sessionId}:`))
      await instances.request(
        ref.instanceId,
        `/v1/workspaces/${ref.machineId}/conversations/${input.agentSessionId.split(":").at(-1)}?limit=1`,
      );
    return { ...ref, sessionId, instances };
  };

  const send = async (ctx: HarnessContext, input: HarnessStartInput & { agentSessionId?: string }) => {
    const ref = await target(ctx, input);
    let machine = await ref.instances.request<Machine>(ref.instanceId, machinePath(ref.machineId), {
      signal: input.signal,
    });
    while (machine.state !== "ready") {
      if (isTerminal(machine)) throw new Error(`Machine is ${machine.state}. Launch a new machine to continue.`);
      const change = await ref.instances.request<{ workspace: Machine }>(
        ref.instanceId,
        `${machinePath(ref.machineId)}/changes?after=${machine.change_cursor}&wait=30`,
        { signal: input.signal },
      );
      machine = change.workspace;
    }
    const capabilities = await supportsFileTurns(ref, input.signal);
    if (!capabilities.requests) throw new Error("Choose a native PocketCoder session template.");
    if (input.attachments?.length && !capabilities.attachments)
      throw new Error("This template does not support immutable file inputs.");
    return startFileTurn(ctx, input, ref);
  };
  return defineHarness({
    id: "agent",
    label: "PocketCoder agent",
    cwdRequirement: "optional",
    capabilities: () => ["SessionReattach", "Attachments"],
    start: (ctx, input) => runs.run(ctx, input, (active) => send(ctx, active)),
    resume: (ctx, input) =>
      runs.run(ctx, input, async (active) => resumeFileTurn(ctx, active, await target(ctx, active))),
    reattach: (ctx, input) =>
      runs.run(ctx, input, async (active) => {
        const ref = await target(ctx, active);
        const pending = await reconnectFileTurn(ctx, active, ref);
        if (!pending) throw new Error("No pending PocketCoder request was found.");
        return pending;
      }),
    dispose: runs.dispose,
    async getMessages(ctx, input) {
      const ref = await target(ctx, input);
      return fileTurnMessages(ctx, ref, input.agentSessionId.split(":").at(-1) ?? "");
    },
    recoverMessages: (_ctx, input) => reconcileMessageHistory(input),
  });
}
