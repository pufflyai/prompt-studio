import { eq } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { session_queue_entries, sessions } from "./schemas.pg";

// The generated column default marks only rows that existed before request revisions.
// New writes always supply a revision, including requests using the provider's default model.
export const snapshotLegacyQueuedRequests = (db: DbClient) =>
  db.transaction(async (tx) => {
    const entries = await tx.select().from(session_queue_entries).where(eq(session_queue_entries.revision, ""));
    for (const entry of entries) {
      const [session] = await tx.select().from(sessions).where(eq(sessions.id, entry.session_id));
      await tx
        .update(session_queue_entries)
        .set({
          model: session?.last_selected_model ?? null,
          params_json: entry.params_json ?? session?.params_json ?? null,
          revision: crypto.randomUUID(),
        })
        .where(eq(session_queue_entries.queue_position, entry.queue_position));
    }
  });
