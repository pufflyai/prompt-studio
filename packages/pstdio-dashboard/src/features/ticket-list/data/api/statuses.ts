import type { StatusResponse } from "pstdio-api/dto";
import type { TicketStatusColor } from "@/features/ticket-list/types";
import { toTicketStatusOption } from "./mappers";
import { executePlannerCommand, listPlannerCollection, toPlannerStatusResponse } from "./planner";

export const getProjectTicketStatuses = async (projectId: string) => {
  const rows = await listPlannerCollection(projectId, "statuses");
  const statuses = rows.map(toPlannerStatusResponse);
  return statuses.map(toTicketStatusOption).sort((left, right) => left.sortOrder - right.sortOrder);
};

export const deleteProjectTicketStatus = async (projectId: string, statusId: string) => {
  await executePlannerCommand(projectId, "deleteStatus", { status_id: statusId });
};

export const createProjectStatus = async (projectId: string, input: { name: string; color: TicketStatusColor }) => {
  const created = await executePlannerCommand<StatusResponse>(projectId, "createStatus", input);
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
  const updated = await executePlannerCommand<StatusResponse>(projectId, "updateStatus", {
    status_id: statusId,
    ...input,
  });
  return toTicketStatusOption(updated);
};

export const setProjectDefaultStatus = async (projectId: string, statusId: string) => {
  await executePlannerCommand(projectId, "setDefaultStatus", { status_id: statusId });
};
