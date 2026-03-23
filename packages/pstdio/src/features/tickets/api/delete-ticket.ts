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
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body && typeof body === "object" && "error" in body ? String(body.error) : `status ${res.status}`;
    throw new Error(`Failed to delete ticket: ${detail}`);
  }

  return (await res.json()) as Ticket;
};
