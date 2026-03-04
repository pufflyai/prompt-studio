type ListTicketsParams = {
  project_id: string;
  status?: string;
  tag?: string[];
  priority?: string;
  complexity?: string;
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
};

type TicketListItem = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  title: string | null;
  priority: string | null;
  complexity: string | null;
  draft: boolean;
  archived: boolean;
  status_name: string | null;
  tag_names: string[];
  created_at: string;
};

export const listTickets = async (baseUrl: string, params: ListTicketsParams) => {
  const url = new URL(`${baseUrl}/v1/tickets`);
  url.searchParams.set("project_id", params.project_id);

  if (params.status) url.searchParams.set("status", params.status);
  if (params.tag) for (const t of params.tag) url.searchParams.append("tag", t);
  if (params.priority) url.searchParams.set("priority", params.priority);
  if (params.complexity) url.searchParams.set("complexity", params.complexity);
  if (params.archived !== undefined) url.searchParams.set("archived", String(params.archived));
  if (params.draft !== undefined) url.searchParams.set("draft", String(params.draft));
  if (params.parent_id) url.searchParams.set("parent_id", params.parent_id);
  if (params.shorthand) url.searchParams.set("shorthand", params.shorthand);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to list tickets: ${res.status}`);

  return (await res.json()) as TicketListItem[];
};
