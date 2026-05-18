import { apiRequest, getApiClient } from "@/lib/api";
import type { ApiTicketFilesResponse } from "./types";

export const getTicketFiles = async (ticketId: string) => {
  return apiRequest<ApiTicketFilesResponse>(`/v1/tickets/${ticketId}/files`);
};

export const getTicketFileContent = async (ticketId: string, fileId: string, signal?: AbortSignal) => {
  const content = await getApiClient().tickets.getFileContent(ticketId, fileId, { cache: "no-store", signal });
  return new TextDecoder().decode(content);
};

export const uploadTicketFile = async (ticketId: string, file: File) => {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  return apiRequest<{ id: string; file_name: string }>(`/v1/tickets/${ticketId}/files`, {
    method: "POST",
    body: {
      file_name: file.name,
      content_base64: base64,
      mime_type: file.type || null,
    },
  });
};

export const deleteTicketFile = async (ticketId: string, fileId: string) => {
  await apiRequest(`/v1/tickets/${ticketId}/files/${fileId}`, { method: "DELETE" });
};
