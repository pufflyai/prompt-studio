export type TicketFile = {
  id: string;
  project_id: string;
  file_name: string;
  file_kind: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  hash: string | null;
  created_at: string;
  updated_at: string;
};

export const listTicketFiles = async (baseUrl: string, ticketId: string) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(ticketId)}/files`);

  if (!res.ok) throw new Error(`Failed to list ticket files: ${res.status}`);

  return (await res.json()) as TicketFile[];
};
