import { apiRequest } from "@/lib/api";
import type { ApiTicketFilesResponse } from "./types";

export const getTicketFiles = async (ticketId: string) => {
  return apiRequest<ApiTicketFilesResponse>(`/v1/tickets/${ticketId}/files`);
};

export const uploadTicketFile = async (ticketId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/v1/tickets/${ticketId}/files`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file");
  }

  const json = await response.json();
  return json.data as { id: string; file_name: string };
};

export const deleteTicketFile = async (ticketId: string, fileId: string) => {
  await fetch(`/v1/tickets/${ticketId}/files/${fileId}`, { method: "DELETE" });
};
