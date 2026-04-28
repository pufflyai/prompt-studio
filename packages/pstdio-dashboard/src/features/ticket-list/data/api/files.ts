import { buildApiUrl } from "@/lib/api";
import { executePlannerCommand, listPlannerCollection } from "./planner";
import type { ApiTicketFilesResponse } from "./types";

export const getTicketFiles = async (projectId: string, ticketId: string) => {
  const rows = await listPlannerCollection(projectId, "tickets");
  const ticket = rows.find((row) => row.item_id === ticketId);
  const files = Array.isArray((ticket?.value_json as { files?: unknown })?.files)
    ? ((ticket?.value_json as { files: ApiTicketFilesResponse["files"] }).files ?? [])
    : [];

  return { files, artifacts: [] };
};

export const getTicketFileContent = async (fileId: string, signal?: AbortSignal) => {
  const response = await fetch(buildApiUrl(`/v1/files/${fileId}/content`), {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error("Failed to load ticket file content");
  }

  return response.text();
};

export const uploadTicketFile = async (projectId: string, ticketId: string, file: File) => {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  return executePlannerCommand<{ id: string; fileName: string }>(projectId, "uploadTicketFile", {
    ticket_id: ticketId,
    file_name: file.name,
    content_base64: base64,
    mime_type: file.type || null,
  });
};

export const deleteTicketFile = async (_ticketId: string, fileId: string) => {
  throw new Error(`Deleting planner ticket files is not available yet: ${fileId}`);
};
