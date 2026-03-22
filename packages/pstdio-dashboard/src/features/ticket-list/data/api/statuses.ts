import type { StatusResponse } from "pstdio-api/dto";
import type { TicketStatusColor } from "@/features/ticket-list/types";
import { apiRequest } from "@/lib/api";
import { toTicketStatusOption } from "./mappers";

export const getProjectTicketStatuses = async (projectId: string) => {
  const statuses = await apiRequest<StatusResponse[]>(`/v1/projects/${projectId}/ticket-statuses`);
  return statuses.map(toTicketStatusOption).sort((left, right) => left.sortOrder - right.sortOrder);
};

export const deleteProjectTicketStatus = async (projectId: string, statusId: string) => {
  await apiRequest(`/v1/projects/${projectId}/statuses/${statusId}`, { method: "DELETE" });
};

export const createProjectStatus = async (projectId: string, input: { name: string; color: TicketStatusColor }) => {
  const created = await apiRequest<StatusResponse>(`/v1/projects/${projectId}/statuses`, {
    method: "POST",
    body: input,
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
  const updated = await apiRequest<StatusResponse>(`/v1/projects/${projectId}/statuses/${statusId}`, {
    method: "PATCH",
    body: input,
  });
  return toTicketStatusOption(updated);
};

export const setProjectDefaultStatus = async (projectId: string, statusId: string) => {
  await apiRequest(`/v1/projects/${projectId}/statuses/${statusId}/set-default`, { method: "PATCH" });
};
