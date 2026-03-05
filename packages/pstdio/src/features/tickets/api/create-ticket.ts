type CreateTicketInput = {
  project_id: string;
  title?: string;
  input?: string;
  priority?: string;
  complexity?: string;
  parent_id?: string;
  draft?: boolean;
  tag_ids?: string[];
  status_id?: string;
};

type Ticket = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  title: string | null;
  draft: boolean;
  created_at: string;
  updated_at: string;
};

export const createTicket = async (baseUrl: string, input: CreateTicketInput) => {
  const res = await fetch(`${baseUrl}/v1/tickets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(`Failed to create ticket: ${res.status}`);

  return (await res.json()) as Ticket;
};
