import type { StatusResponse } from "pstdio-api/dto";
import { apiRequest } from "@/lib/api";
import { toTicketStatusOption } from "./mappers";

export const getProjectTicketStatuses = async (projectId: string) => {
  const statuses = await apiRequest<StatusResponse[]>(`/v1/projects/${projectId}/ticket-statuses`);
  return statuses.map(toTicketStatusOption).sort((left, right) => left.sortOrder - right.sortOrder);
};

export const deleteProjectTicketStatus = async (projectId: string, statusId: string) => {
  await apiRequest(`/v1/projects/${projectId}/ticket-statuses/${statusId}`, { method: "DELETE" });
};
