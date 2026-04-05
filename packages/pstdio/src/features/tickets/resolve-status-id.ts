import { listTicketStatuses } from "./api/list-ticket-statuses";

export const resolveStatusId = async (projectId: string, statusName: string) => {
  const statuses = await listTicketStatuses(projectId);
  const found = statuses.find((s) => s.name === statusName);
  if (!found) throw new Error(`Status not found: ${statusName}`);
  return found.id;
};
