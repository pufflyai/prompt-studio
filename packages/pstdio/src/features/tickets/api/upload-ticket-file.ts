import type { TicketFile } from "./list-ticket-files";

type UploadTicketFileInput = {
  file_name: string;
  content_base64: string;
  mime_type?: string;
};

export const uploadTicketFile = async (baseUrl: string, ticketId: string, input: UploadTicketFileInput) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${encodeURIComponent(ticketId)}/files`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(`Failed to upload ticket file: ${res.status}`);

  return (await res.json()) as TicketFile;
};
