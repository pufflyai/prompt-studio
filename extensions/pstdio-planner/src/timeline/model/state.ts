// Derive one displayed state from the ticket's workflow, requests, and prerequisites.

import { emptyWorkflowStatuses, type WorkflowStatusSelections } from "../../data/workflow-statuses";
import type { PlannerTicket } from "../planner";

export type TicketState = "await-input" | "input-received" | "done" | "not-started" | "in-progress" | "blocked";

export interface StateSignals {
  humanNeeded: boolean;
  // Every request is settled and at least one was answered; an agent still has to verify the result.
  inputReceived: boolean;
  unmet: boolean;
}

export function ticketState(
  ticket: PlannerTicket,
  signals: StateSignals,
  selections: WorkflowStatusSelections = emptyWorkflowStatuses(),
) {
  const status = ticket.statusId ?? "";
  const active = selections.activeStatusIds.includes(status);
  if (selections.completedStatusIds.includes(status)) {
    return "done" as const;
  }
  if (signals.humanNeeded) {
    return "await-input" as const;
  }
  // Active work supersedes old answers; input-received only marks idle tickets an agent should pick up.
  if (signals.inputReceived && !active) {
    return "input-received" as const;
  }
  if (!signals.unmet && (selections.blockedStatusIds.includes(status) || ticket.blockedReason?.trim())) {
    return "blocked" as const;
  }
  if (active) {
    return "in-progress" as const;
  }
  return "not-started" as const;
}
