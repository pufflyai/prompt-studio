type UpdateTicketInput = {
  display_title?: string;
  user_prompt?: string;
  file_id?: string;
  status_id?: string;
  priority?: string;
  complexity?: string;
  draft?: boolean;
  archived?: boolean;
  tag_ids?: string[];
};

type Ticket = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  display_title: string | null;
  file_id: string | null;
  draft: boolean;
  created_at: string;
  updated_at: string;
};

export const updateTicket = async (baseUrl: string, id: string, input: UpdateTicketInput) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(`Failed to update ticket: ${res.status}`);

  return (await res.json()) as Ticket;
};
