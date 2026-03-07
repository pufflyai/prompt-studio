type Ticket = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  display_title: string | null;
  user_prompt: string | null;
  file_id: string | null;
  priority: string | null;
  complexity: string | null;
  parent_id: string | null;
  parallelizable: string | null;
  blocked_reason: string | null;
  depends_on: string | null;
  draft: boolean;
  archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export const getTicket = async (baseUrl: string, id: string) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(id)}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get ticket: ${res.status}`);

  return (await res.json()) as Ticket;
};
