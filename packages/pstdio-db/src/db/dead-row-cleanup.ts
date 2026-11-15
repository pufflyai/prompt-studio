import type { PGlite } from "@electric-sql/pglite";

const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * PGlite runs no autovacuum, so rewritten rows stay on disk until something vacuums them.
 * This applies the autovacuum default rule: a table, or its TOAST table, needs a vacuum once its
 * dead rows exceed 50 plus 20% of its estimated rows. The estimate is `reltuples`, which survives a
 * restart; PGlite starts every session with empty activity counters. A plain VACUUM makes the space
 * reusable without a rewrite; startup maintenance keeps VACUUM FULL for after migrations.
 */
export const vacuumDeadRows = async (
  db: PGlite,
  options: { stopped?: () => boolean; onError?: (error: unknown, table?: string) => void } = {},
) => {
  const { rows } = await db.query<{ name: string }>(
    `SELECT c.oid::regclass::text AS name
     FROM pg_class c
     JOIN pg_stat_all_tables s ON s.relid = c.oid
     LEFT JOIN pg_class tc ON tc.oid = c.reltoastrelid
     LEFT JOIN pg_stat_all_tables t ON t.relid = c.reltoastrelid
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind = 'r'
       AND (
         s.n_dead_tup > 50 + 0.2 * greatest(c.reltuples, 0)
         OR coalesce(t.n_dead_tup, 0) > 50 + 0.2 * greatest(coalesce(tc.reltuples, 0), 0)
       )
     ORDER BY greatest(s.n_dead_tup, coalesce(t.n_dead_tup, 0)) DESC`,
  );
  const vacuumed: string[] = [];
  for (const { name } of rows) {
    // PGlite runs each statement on the main thread, so yield between tables to let waiting requests run.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (options.stopped?.()) break;
    try {
      // PGlite queues each statement behind any open transaction, so a vacuum never runs inside one.
      await db.exec(`VACUUM ${name}`);
      vacuumed.push(name);
    } catch (error) {
      options.onError?.(error, name);
    }
  }
  return vacuumed;
};

export const startDeadRowCleanup = (db: PGlite, onError: (error: unknown, table?: string) => void) => {
  let stopped = false;
  let running: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    running ??= vacuumDeadRows(db, { stopped: () => stopped, onError })
      .catch((error) => onError(error))
      .finally(() => {
        running = undefined;
      });
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
};
