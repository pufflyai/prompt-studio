type TicketStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export const listTicketStatuses = async (baseUrl: string, projectId: string) => {
  const res = await fetch(`${baseUrl}/v1/projects/${encodeURIComponent(projectId)}/ticket-statuses`);
  if (!res.ok) throw new Error(`Failed to list statuses: ${res.status}`);
  return (await res.json()) as TicketStatus[];
};
