type Ticket = {
  id: string;
  shorthand: string;
  project_id: string;
  deleted_at: string | null;
};

export const deleteTicket = async (baseUrl: string, id: string) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to delete ticket: ${res.status}`);

  return (await res.json()) as Ticket;
};
