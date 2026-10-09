// Derive one displayed state from the ticket's workflow, requests, and prerequisites.
import type { PlannerTicket } from "../planner";

export type TicketState = "await-input" | "input-received" | "done" | "not-started" | "in-progress" | "blocked";

export interface StateSignals {
  humanNeeded: boolean;
  // Every request is settled and at least one was answered; an agent still has to verify the result.
  inputReceived: boolean;
  unmet: boolean;
}

export function ticketState(ticket: PlannerTicket, signals: StateSignals): TicketState {
  if (ticket.statusId === "done") {
    return "done";
  }
  if (signals.humanNeeded) {
    return "await-input";
  }
  if (signals.inputReceived) {
    return "input-received";
  }
  if (ticket.statusId === "blocked" || ticket.blockedReason?.trim() || signals.unmet) {
    return "blocked";
  }
  if (ticket.statusId === "in-progress" || ticket.statusId === "in-review") {
    return "in-progress";
  }
  return "not-started";
}
