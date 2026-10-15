import type { AttemptRecord } from "../data/attempt-types";
import type { PlanRow } from "../timeline/contracts";
import { workflowName } from "../timeline/model/workflow";
import type { WaitingTicket } from "./next-ticket-types";

interface NextTicketWaitInput {
  pending: { shorthand: string }[];
  assigned: boolean;
  attempts: AttemptRecord[];
  resumable: boolean;
  capacity: { running: number; limit: number };
}

export function nextTicketWait(row: PlanRow, input: NextTicketWaitInput) {
  const wait = (reason: WaitingTicket["reason"], dependencyIds: string[] = [], detail?: string) => ({
    reason,
    dependencyIds,
    ...(detail ? { detail } : {}),
  });
  if (input.pending.length || row.flags.includes("human-needed"))
    return wait(
      "human-input-needed",
      input.pending.map(({ shorthand }) => shorthand),
    );
  if (row.gate) return wait("review-gate");
  if (row.blockedReason || workflowName(row.status?.name) === "blocked") return wait("blocked", [], row.blockedReason);
  if (input.assigned) return wait("assigned");
  if (input.attempts.length && !input.resumable)
    return wait(
      "existing-attempt",
      [],
      input.attempts.map(({ workspaceShorthand, state }) => `${workspaceShorthand}: ${state}`).join(", "),
    );
  if (input.capacity.running >= input.capacity.limit) return wait("capacity-full");
  return null;
}
