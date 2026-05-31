import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { workspace_artifacts } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

/** @deprecated Legacy ticket artifact DB service. Ticket artifacts are owned by the pstdio tickets extension. */
export const createWorkspaceArtifactsDBService = (db: DbClient) => {
  const listForTicket = async (ticketId: string) =>
    db.select().from(workspace_artifacts).where(eq(workspace_artifacts.ticket_id, ticketId));

  const getByTicketPath = async (ticketId: string, relativePath: string) => {
    const rows = await db
      .select()
      .from(workspace_artifacts)
      .where(and(eq(workspace_artifacts.ticket_id, ticketId), eq(workspace_artifacts.relative_path, relativePath)));

    return rows[0] ?? null;
  };

  const upsertByTicketPath = async (ticketId: string, fileId: string, relativePath: string) => {
    const existing = await getByTicketPath(ticketId, relativePath);
    if (existing) {
      const [updated] = await db
        .update(workspace_artifacts)
        .set({ file_id: fileId })
        .where(eq(workspace_artifacts.id, existing.id))
        .returning();

      return updated ?? existing;
    }

    const record = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      file_id: fileId,
      relative_path: relativePath,
      created_at: nowTimestamp(),
    };

    await db.insert(workspace_artifacts).values(record);
    return record;
  };

  return { listForTicket, getByTicketPath, upsertByTicketPath };
};
