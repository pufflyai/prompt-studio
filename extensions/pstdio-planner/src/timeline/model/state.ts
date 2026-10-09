// Derive one displayed state from the ticket's workflow, requests, and prerequisites.

import type { PlannerTicket } from "../planner";
import { workflowName } from "./workflow";

export type TicketState = "await-input" | "input-received" | "done" | "not-started" | "in-progress" | "blocked";

export interface StateSignals {
  humanNeeded: boolean;
  // Every request is settled and at least one was answered; an agent still has to verify the result.
  inputReceived: boolean;
  unmet: boolean;
}

export function ticketState(ticket: PlannerTicket, signals: StateSignals, statusName: string | undefined) {
  const status = workflowName(statusName);
  if (status === "done") {
    return "done" as const;
  }
  if (signals.humanNeeded) {
    return "await-input" as const;
  }
  if (signals.inputReceived) {
    return "input-received" as const;
  }
  if (!signals.unmet && (status === "blocked" || ticket.blockedReason?.trim())) {
    return "blocked" as const;
  }
  if (status === "in-progress" || status === "in-review") {
    return "in-progress" as const;
  }
  return "not-started" as const;
}
