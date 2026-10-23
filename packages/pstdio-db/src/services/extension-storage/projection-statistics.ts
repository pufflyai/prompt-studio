import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";

/**
 * PGlite runs no autovacuum, so storage keeps planner statistics for its query projection.
 * Without them, Postgres guesses that an in-list matches most rows and scans the whole owner.
 * This uses the autovacuum default rule: analyze after 50 rows plus 10% of the table changed.
 * PGlite reports pg_stat change counters late, so writers count their own projected rows.
 */
export const createProjectionStatistics = (db: Pick<DbClient, "execute">) => {
  let changed = 0;
  let pending: Promise<void> | undefined;
  const stale = async () => {
    const { rows } = await db.execute<{ rows: number }>(
      sql`SELECT greatest(reltuples, 0) AS rows FROM pg_class WHERE relname = 'storage_current_records'`,
    );
    return changed > 50 + 0.1 * Number(rows[0]?.rows ?? 0);
  };
  const run = async () => {
    while (await stale()) {
      changed = 0;
      await db.execute(sql`ANALYZE storage_current_records`);
    }
  };
  return {
    /** Runs after the committed write, never inside a read or a write transaction. */
    record: (rows: number) => {
      changed += rows;
      if (pending) return;
      pending = run().finally(() => {
        pending = undefined;
      });
      // A failed refresh leaves statistics stale; flush reports it, the write already succeeded.
      pending.catch(() => {});
    },
    flush: async () => {
      while (pending) await pending;
    },
  };
};
