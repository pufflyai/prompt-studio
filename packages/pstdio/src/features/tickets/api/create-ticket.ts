type CreateTicketInput = {
  project_id: string;
  content?: string;
  user_prompt?: string;
  file_id?: string;
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
  display_title: string | null;
  file_id: string | null;
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

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error ?? `HTTP ${res.status}`;
    throw new Error(`Failed to create ticket: ${message}`);
  }

  return (await res.json()) as Ticket;
};
