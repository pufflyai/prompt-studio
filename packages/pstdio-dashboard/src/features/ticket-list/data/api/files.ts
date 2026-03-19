import { apiRequest } from "@/lib/api";
import type { ApiTicketFilesResponse } from "./types";

export const getTicketFiles = async (ticketId: string) => {
  return apiRequest<ApiTicketFilesResponse>(`/v1/tickets/${ticketId}/files`);
};

export const getTicketFileContent = async (ticketId: string, fileId: string, signal?: AbortSignal) => {
  const response = await fetch(`/v1/tickets/${ticketId}/files/${fileId}/content`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to load ticket file content");
  }

  return response.text();
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
  await fetch(`/v1/tickets/${ticketId}/files/${fileId}`, { method: "DELETE" });
};
