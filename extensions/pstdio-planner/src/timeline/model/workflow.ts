import type { WorkflowStatusSelections } from "../../data/workflow-statuses";
import type { PlannerTicket } from "../planner";

export const isCompletedTicket = (ticket: PlannerTicket, selections: WorkflowStatusSelections) =>
  selections.completedStatusIds.includes(ticket.statusId ?? "");
