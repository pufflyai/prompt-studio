type Ticket = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  title: string | null;
  input: string | null;
  draft: boolean;
  created_at: string;
  updated_at: string;
};

export const getTicket = async (baseUrl: string, id: string) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(id)}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get ticket: ${res.status}`);

  return (await res.json()) as Ticket;
};
