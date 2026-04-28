import { createPlannerClient, type PlannerTicketFileCommandResult } from "@pstdio/pstdio-ext-planner/sdk";
import type { FileRecord } from "@pstdio/sdk/resources";
import { API_URL } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

const plannerClient = () =>
  createPlannerClient({
    baseUrl: process.env.PSTDIO_API_URL ?? API_URL,
    token: process.env.PSTDIO_API_TOKEN,
  });

const toFileRecord = (projectId: string, file: PlannerTicketFileCommandResult): FileRecord => {
  const timestamp = new Date().toISOString();

  return {
    id: file.id,
    project_id: projectId,
    file_name: file.fileName,
    file_kind: "ticket_file",
    storage_path: `planner://${file.id}`,
    mime_type: file.mimeType,
    size_bytes: 0,
    hash: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

export const uploadTicketFile = async (
  ticketId: string,
  input: {
    file_name: string;
    relative_path?: string;
    content_base64: string;
    mime_type?: string;
  },
) => {
  const { projectId } = resolveProjectId(process.cwd());
  const file = await plannerClient().uploadTicketFile(projectId, {
    ticket_id: ticketId,
    file_name: input.file_name,
    relative_path: input.relative_path,
    content_base64: input.content_base64,
    mime_type: input.mime_type,
  });

  return toFileRecord(projectId, file);
};
