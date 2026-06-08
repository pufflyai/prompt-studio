import type { TicketStatusColor } from "@/features/ticket-list/types";
import { executePlannerCommand, type PlannerStatus, readPlannerTicketStatuses, toTicketStatusOption } from "./planner";

export const getProjectTicketStatuses = async (projectId: string) => {
  const statuses = await readPlannerTicketStatuses(projectId);
  return statuses.map(toTicketStatusOption).sort((left, right) => left.sortOrder - right.sortOrder);
};

export const deleteProjectTicketStatus = async (projectId: string, statusId: string) => {
  await executePlannerCommand(projectId, "ticketStatus.delete", { statusId });
};

export const createProjectStatus = async (projectId: string, input: { name: string; color: TicketStatusColor }) => {
  const created = await executePlannerCommand<PlannerStatus>(projectId, "ticketStatus.create", {
    label: input.name,
    color: input.color,
  });
  return toTicketStatusOption(created);
};

export const updateProjectStatus = async (
  projectId: string,
  statusId: string,
  input: {
    name?: string;
    color?: TicketStatusColor;
    sort_order?: number;
    can_create?: boolean;
    can_drag_in?: boolean;
    can_drag_out?: boolean;
    column_actions?: string[];
  },
) => {
  const updated = await executePlannerCommand<PlannerStatus>(projectId, "ticketStatus.update", {
    statusId,
    label: input.name,
    color: input.color,
    sortOrder: input.sort_order,
    canCreate: input.can_create,
    canDragIn: input.can_drag_in,
    canDragOut: input.can_drag_out,
    columnActions: input.column_actions,
  });
  return toTicketStatusOption(updated);
};

export const setProjectDefaultStatus = async (projectId: string, statusId: string) => {
  await executePlannerCommand(projectId, "ticketStatus.setDefault", { status: statusId });
};
