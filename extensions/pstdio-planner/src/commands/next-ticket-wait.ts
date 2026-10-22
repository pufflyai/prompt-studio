import type { AttemptRecord } from "../data/attempt-types";
import type { PlanRow } from "../timeline/contracts";
import type { WaitingTicket } from "./next-ticket-types";

interface NextTicketWaitInput {
  pending: { shorthand: string }[];
  assigned: boolean;
  attempts: AttemptRecord[];
  resumable: boolean;
  answeredInput: boolean;
  blockedStatusIds: string[];
  capacity: { running: number; limit: number };
}

export function nextTicketWait(row: PlanRow, input: NextTicketWaitInput) {
  const wait = (reason: WaitingTicket["reason"], dependencyIds: string[] = [], detail?: string) => ({
    reason,
    dependencyIds,
    ...(detail ? { detail } : {}),
  });
  if (input.pending.length)
    return wait(
      "human-input-needed",
      input.pending.map(({ shorthand }) => shorthand),
    );
  if (row.gate) return wait("review-gate");
  // An agent marks its own ticket blocked while it waits; answered input lets the same owner resume.
  if (!input.answeredInput && (row.blockedReason || input.blockedStatusIds.includes(row.status?.id ?? "")))
    return wait("blocked", [], row.blockedReason);
  if (input.assigned) return wait("assigned");
  if (input.attempts.length && !input.resumable)
    return wait("existing-attempt", [], input.attempts.map(({ workspaceShorthand }) => workspaceShorthand).join(", "));
  if (input.capacity.running >= input.capacity.limit) return wait("capacity-full");
  return null;
}
