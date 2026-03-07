import { listTickets } from "./api/list-tickets";

export const resolveTicketByShorthand = async (baseUrl: string, projectId: string, shorthand: string) => {
  const published = await listTickets(baseUrl, { project_id: projectId, shorthand });
  if (published.length > 0) return published[0];

  const drafts = await listTickets(baseUrl, { project_id: projectId, shorthand, draft: true });
  return drafts[0] ?? null;
};
