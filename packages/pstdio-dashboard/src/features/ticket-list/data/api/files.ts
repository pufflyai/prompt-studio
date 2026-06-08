import { executePlannerCommand, type PlannerTicketFile, readPlannerTicket } from "./planner";
import type { ApiTicketFilesResponse } from "./types";

const toFilePreview = (file: PlannerTicketFile) => ({
  id: file.id,
  file_name: file.name,
  file_kind: "ticket",
  mime_type: file.name.endsWith(".md") ? "text/markdown" : "text/plain",
  size_bytes: new TextEncoder().encode(file.content).byteLength,
  created_at: file.createdAt,
});

export const getTicketFiles = async (projectId: string, ticketId: string): Promise<ApiTicketFilesResponse> => {
  const ticket = await readPlannerTicket(projectId, ticketId);
  return {
    files: (ticket?.files ?? []).map(toFilePreview),
    artifacts: [],
  };
};

export const getTicketFileContent = async (
  projectId: string,
  ticketId: string,
  fileId: string,
  signal?: AbortSignal,
) => {
  const ticket = await readPlannerTicket(projectId, ticketId, signal);
  return ticket?.files?.find((file) => file.id === fileId)?.content ?? "";
};

export const uploadTicketFile = async (projectId: string, ticketId: string, file: File) => {
  const content = await file.text();
  const ticket = await readPlannerTicket(projectId, ticketId);
  const existing = ticket?.files?.find((candidate) => candidate.name === file.name);
  const target =
    existing ??
    (await executePlannerCommand<PlannerTicketFile>(projectId, "create-ticket-file", {
      ticketId,
      name: file.name,
    }));

  return executePlannerCommand<PlannerTicketFile>(projectId, "update-ticket-file", {
    ticketId,
    fileId: target.id,
    name: file.name,
    content,
  });
};

export const deleteTicketFile = async (projectId: string, ticketId: string, fileId: string) => {
  await executePlannerCommand(projectId, "delete-ticket-file", { ticketId, fileId });
};
