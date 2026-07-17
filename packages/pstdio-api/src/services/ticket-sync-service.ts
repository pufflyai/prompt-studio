import { eq } from "drizzle-orm";
import { type DbClient, synced_tickets } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

interface TicketQueryRow {
  id: string;
  title: string;
  attributes: {
    id: string;
    parentId?: string;
  };
}

interface TicketQueryResult {
  rows: TicketQueryRow[];
}

const ticketQueryResult = (value: unknown): TicketQueryResult => value as TicketQueryResult;

export const createTicketSyncService = (input: { db: DbClient; eventBus: EventBus }) => {
  const replaceFromQuery = async (projectId: string, value: unknown) => {
    const rows = ticketQueryResult(value).rows.map((row) => ({
      id: row.id,
      project_id: projectId,
      shorthand: row.attributes.id,
      title: row.title,
      parent_id: row.attributes.parentId || null,
    }));
    const previous = await input.db.select().from(synced_tickets).where(eq(synced_tickets.project_id, projectId));
    const nextIds = new Set(rows.map((row) => row.id));

    await input.db.transaction(async (tx) => {
      await tx.delete(synced_tickets).where(eq(synced_tickets.project_id, projectId));
      if (rows.length > 0) await tx.insert(synced_tickets).values(rows);
    });

    for (const row of previous) {
      if (!nextIds.has(row.id)) input.eventBus.emit("tickets", "delete", { id: row.id });
    }
    for (const row of rows) input.eventBus.emit("tickets", "set", row);
  };

  return { replaceFromQuery };
};
