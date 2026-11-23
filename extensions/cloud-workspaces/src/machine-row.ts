import { type instancesFor, PocketCoderHttpError } from "./instances";
import { machineStateLabel } from "./machine-status";
import { type ControllerMachine, isTerminal, machinePath } from "./machines";
import { machineKind } from "./resources";

export interface MachineCheckpoint {
  id: string;
  state: string;
  conversation_restore: "supported" | "filesystem_only" | "unknown";
}

export async function readyMachineCheckpoint(
  instances: Pick<ReturnType<typeof instancesFor>, "request">,
  instanceId: string,
  machine: ControllerMachine,
) {
  if (!machine.persistence.enabled) return null;
  const { items } = await instances.request<{ items: MachineCheckpoint[] }>(
    instanceId,
    `${machinePath(machine.id)}/checkpoints?state=ready&limit=1`,
  );
  if (items[0]) return items[0];
  // Match Resume's recovery path for a restored machine that never connected.
  if (machine.restored_from_checkpoint_id && machine.connected_at === null) {
    try {
      const checkpoint = await instances.request<MachineCheckpoint>(
        instanceId,
        `/v1/checkpoints/${encodeURIComponent(machine.restored_from_checkpoint_id)}`,
      );
      if (checkpoint.state === "ready") return checkpoint;
    } catch (error) {
      if (!(error instanceof PocketCoderHttpError && error.status === 404)) throw error;
    }
  }
  return null;
}

export function projectMachineRow(
  instanceId: string,
  machine: ControllerMachine,
  checkpoint: MachineCheckpoint | null,
) {
  const ready = checkpoint?.state === "ready";
  const canResume = ready && checkpoint.conversation_restore === "supported";
  let recovery = "No checkpoint";
  if (ready) {
    recovery = "Restore capability unknown";
    if (checkpoint.conversation_restore === "supported") recovery = "Conversation saved";
    if (checkpoint.conversation_restore === "filesystem_only") recovery = "Files only";
  }
  let runtime = "Running";
  if (["queued", "provisioning"].includes(machine.state)) runtime = "Starting";
  if (machine.state === "terminating") runtime = "Stopping";
  if (isTerminal(machine)) runtime = "Destroyed";
  return {
    id: `${instanceId}:${machine.id}`,
    resource: {
      type: machineKind.id,
      id: `${instanceId}:${machine.id}`,
      label: machine.external_id,
      metadata: { canResume, canConnect: machine.state === "ready" },
    },
    values: {
      name: machine.external_id,
      template: `${machine.template.name}@${machine.template.version}`,
      state: machineStateLabel(machine.state),
      createdAt: machine.created_at,
      runtime,
      recovery,
      error: machine.failure?.log_tail ?? machine.reason_code ?? "",
    },
  };
}
