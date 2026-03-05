import { listTicketStatuses } from "./api/list-ticket-statuses";

export const resolveStatusId = async (baseUrl: string, projectId: string, statusName: string) => {
  const statuses = await listTicketStatuses(baseUrl, projectId);
  const found = statuses.find((s) => s.name === statusName);
  if (!found) throw new Error(`Status not found: ${statusName}`);
  return found.id;
};
