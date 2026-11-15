import type { PGlite } from "@electric-sql/pglite";

const CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * PGlite runs no autovacuum, so rewritten rows stay on disk until something vacuums them.
 * This applies the autovacuum default rule: a table, or its TOAST table, needs a vacuum once its
 * dead rows exceed 50 plus 20% of its live rows. A plain VACUUM makes the space reusable without
 * the exclusive rewrite of VACUUM FULL, which startup maintenance keeps for after migrations.
 */
export const vacuumDeadRows = async (db: PGlite) => {
  const { rows } = await db.query<{ name: string }>(
    `SELECT c.relname AS name
     FROM pg_class c
     JOIN pg_stat_all_tables s ON s.relid = c.oid
     LEFT JOIN pg_stat_all_tables t ON t.relid = c.reltoastrelid
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind = 'r'
       AND (s.n_dead_tup > 50 + 0.2 * s.n_live_tup OR coalesce(t.n_dead_tup, 0) > 50 + 0.2 * coalesce(t.n_live_tup, 0))
     ORDER BY greatest(s.n_dead_tup, coalesce(t.n_dead_tup, 0)) DESC`,
  );
  // PGlite queues each statement behind any open transaction, so a vacuum never runs inside one.
  for (const { name } of rows) await db.exec(`VACUUM "${name.replaceAll('"', '""')}"`);
  return rows.map((row) => row.name);
};

export const startDeadRowCleanup = (db: PGlite, onError: (error: unknown) => void) => {
  let running: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    running ??= vacuumDeadRows(db)
      .catch(onError)
      .finally(() => {
        running = undefined;
      });
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
  return async () => {
    clearInterval(timer);
    await running;
  };
};
