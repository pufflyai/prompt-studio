import { and, eq, sql } from "drizzle-orm";
import type { ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import type { DbClient } from "../../db/connection.pglite";
import { files, session_queue_entries, sessions, workspace_sessions, workspaces } from "../../db/schemas.pg";
import { sessionColumns, workspaceColumns } from "../legacy-resource-links";
import { createResourceLinksDBService } from "../resource-links";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const readAnchorSources = async (tx: Transaction, changes: Array<{ source: ResourceRef }>, id: string) => {
  const sessionSources: Array<typeof sessions.$inferSelect & { anchors_json: ResourceAnchor[] }> = [];
  const workspaceSources: Array<typeof workspaces.$inferSelect & { anchors_json: ResourceAnchor[] }> = [];
  const sources = new Map(
    changes
      .filter((change) => change.source.extensionId === "pstdio")
      .map((change) => [JSON.stringify([change.source.type, change.source.id]), change.source]),
  );
  for (const source of sources.values()) {
    if (source.type === "session" && source.id !== id) {
      const [row] = await tx.select(sessionColumns).from(sessions).where(eq(sessions.id, source.id));
      if (row) sessionSources.push(row);
    }
    if (source.type === "workspace") {
      const [row] = await tx.select(workspaceColumns).from(workspaces).where(eq(workspaces.id, source.id));
      if (row && !row.deleted_at) workspaceSources.push(row);
    }
  }
  return { sessionSources, workspaceSources };
};

const removeCheckpoint = async (
  tx: Transaction,
  session: typeof sessions.$inferSelect,
  prepare: (file: typeof files.$inferSelect) => Promise<void>,
) => {
  if (!session.session_file_id) return;
  // Checkpoints have a distinct kind. Shared storage belongs to its remaining owners.
  const [file] = await tx
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, session.session_file_id),
        eq(files.file_kind, "session_messages"),
        eq(files.project_id, session.project_id!),
      ),
    )
    .for("update");
  if (!file) return;
  const references = await tx.execute<{ used: boolean }>(sql`select
    exists(select 1 from sessions where session_file_id = ${file.id} or original_session_id = ${session.id})
    or exists(select 1 from workspaces where startup_log_file_id = ${file.id})
    or exists(select 1 from skill_files where file_id = ${file.id})
    or exists(select 1 from extension_files where file_id = ${file.id})
    or exists(select 1 from session_queue_entries where attachments_json @> ${JSON.stringify([{ file_id: file.id }])}::jsonb)
    or exists(select 1 from resource_anchors where
      (source_kind = 'file' and source_id = ${file.id}) or (target_kind = 'file' and target_id = ${file.id})) as used`);
  if (references.rows[0]?.used) return;
  await prepare(file);
  await tx.delete(files).where(eq(files.id, file.id));
  return file.id;
};

export const removeSession = async (
  db: DbClient,
  id: string,
  prepareCheckpoint: (file: typeof files.$inferSelect) => Promise<void>,
) =>
  db.transaction(async (tx) => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, id)).for("update");
    if (!session) return { status: "missing" as const };
    const entries = await tx.select().from(session_queue_entries).where(eq(session_queue_entries.session_id, id));
    const pendingWork = entries.some((entry) => !entry.dispatch_started_at || entry.steering_delivery_json);
    if (["in_progress", "awaiting_input", "queued"].includes(session.status) || pendingWork) {
      return { status: "busy" as const };
    }
    const links = await tx.select().from(workspace_sessions).where(eq(workspace_sessions.session_id, id));
    const changes = session.project_id
      ? await createResourceLinksDBService(tx).removeResource({
          type: "session",
          id,
          extensionId: "pstdio",
          projectId: session.project_id,
        })
      : [];
    await tx.delete(sessions).where(eq(sessions.id, id));
    const sources = await readAnchorSources(tx, changes, id);
    const checkpointId = await removeCheckpoint(tx, session, prepareCheckpoint);
    return { status: "removed" as const, session, links, changes, checkpointId, ...sources };
  });
