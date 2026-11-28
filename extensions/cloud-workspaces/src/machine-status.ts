import { machineStateLabel } from "./machine-labels";
import type { MachineCheckpoint } from "./machine-row";
import { isTerminal, type Machine } from "./machines";

export { machineStateLabel, machineStates } from "./machine-labels";

export function unavailableMachineMessage(
  machine: Pick<Machine, "state" | "reason_code">,
  checkpoint: MachineCheckpoint | null = null,
) {
  if (machine.state === "ready") return undefined;
  if (isTerminal(machine)) {
    const reason = machine.reason_code ? ` (${machine.reason_code})` : "";
    if (checkpoint?.state === "ready" && checkpoint.conversation_restore === "supported")
      return `Machine is ${machine.state}${reason}. Its runtime is destroyed. Use Resume machine to restore its saved conversation, or Relaunch machine to start fresh.`;
    return `Machine is ${machine.state}${reason}. Its runtime is destroyed and it has no resumable conversation checkpoint. Use Relaunch machine to start fresh.`;
  }
  if (["queued", "provisioning", "connected"].includes(machine.state))
    return `Machine is starting (${machineStateLabel(machine.state)}). Wait until its state is Ready.`;
  return `Machine is ${machineStateLabel(machine.state)}. Connect is available only when its state is Ready.`;
}
