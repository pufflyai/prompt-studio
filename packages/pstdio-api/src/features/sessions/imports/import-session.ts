import type { SessionsRouteDeps } from "../deps";
import { sessionAttachmentContentUrl } from "../session-attachments";
import type { SessionImportStaging } from "./job-store";
import { type ExportedSession, importedSessionId, type openSessionImportSource } from "./source";

export type SessionImportDeps = Pick<
  SessionsRouteDeps,
  "sessionService" | "fileService" | "projectService" | "workspaceService"
>;
const discardUncommittedFiles = async (
  deps: SessionImportDeps,
  sessionId: string,
  projectId: string,
  files: string[],
) => {
  // Notifications can throw after the session transaction has committed.
  const committed = await deps.sessionService.get(sessionId);
  if (committed?.session_file_id && files.includes(committed.session_file_id)) return;
  for (const fileId of files) await deps.fileService.discardUpload(projectId, fileId);
};
export const importHistoricalSession = async (
  deps: SessionImportDeps,
  source: Awaited<ReturnType<typeof openSessionImportSource>>,
  session: ExportedSession,
  projectId: string,
  stage: (staging: SessionImportStaging) => Promise<void>,
) => {
  const id = importedSessionId(session.id, projectId);
  if (await deps.sessionService.get(id)) return false;
  if (!(await deps.projectService.get(projectId))) throw new Error(`Destination project not found: ${projectId}`);
  const { messages, attachments } = await source.history(session);
  const createdFiles: string[] = [];
  const allocateFile = async () => {
    const fileId = crypto.randomUUID();
    createdFiles.push(fileId);
    await stage({ sessionId: id, projectId, files: [...createdFiles] });
    return fileId;
  };
  try {
    const fileIds = new Map<string, string>();
    for (const [sourceId, attachment] of attachments) {
      const uploaded = await deps.fileService.upload({
        id: await allocateFile(),
        project_id: projectId,
        file_name: attachment.file.file_name,
        file_kind: "session_attachment",
        mime_type: attachment.file.mime_type,
        data: Bun.file(attachment.path).stream(),
      });
      fileIds.set(sourceId, uploaded.id);
    }
    for (const message of messages)
      for (const part of message.parts) {
        if (part.type !== "file" || !part.fileId) continue;
        const fileId = fileIds.get(part.fileId)!;
        part.fileId = fileId;
        part.url = sessionAttachmentContentUrl(projectId, fileId);
      }
    const workspace = await deps.workspaceService.getDefault(projectId);
    const workspaceId = workspace && !workspace.deleted_at ? workspace.id : undefined;
    let created = false;
    await deps.fileService.upload(
      {
        id: await allocateFile(),
        project_id: projectId,
        file_name: "session-messages.json",
        file_kind: "session_messages",
        mime_type: "application/json",
        data: Buffer.from(JSON.stringify(messages)),
      },
      async (file) => {
        const status = session.status === "failed" || session.status === "cancelled" ? session.status : "completed";
        const settled = ["completed", "failed", "cancelled"].includes(session.status);
        const result = await deps.sessionService.importHistorical({
          workspaceId,
          record: {
            id,
            project_id: projectId,
            title: session.title,
            status: settled ? status : "cancelled",
            archived: session.archived,
            agent: session.agent,
            agent_session_id: null,
            session_file_id: file.id,
            last_selected_model: session.last_selected_model,
            params_json: session.params_json,
            usage_json: session.usage_json,
            original_session_id: session.original_session_id
              ? importedSessionId(session.original_session_id, projectId)
              : null,
            cwd: workspace?.root_path ?? null,
            last_request_started: session.last_request_started,
            last_request_ended: session.last_request_ended,
            created_at: session.created_at,
            updated_at: session.updated_at,
          },
        });
        created = result.created;
      },
    );
    if (!created) await discardUncommittedFiles(deps, id, projectId, createdFiles);
    return created;
  } catch (error) {
    await discardUncommittedFiles(deps, id, projectId, createdFiles);
    throw error;
  }
};
