import type { PlannerTicketWorkflow } from "../contract";
import { pullLocalTickets } from "./pull";
import { pushLocalTicket } from "./push";

export const localTicketWorkflow = {
  pull: pullLocalTickets,
  push: pushLocalTicket,
} satisfies PlannerTicketWorkflow;

export { pullLocalTickets } from "./pull";
export { pushLocalTicket } from "./push";
