import type { PGlite } from "@electric-sql/pglite";

// Each registered expression statistic evaluates JSON for every sampled row on the
// PGlite host thread. Target 10 samples about 3,000 rows across the shared table.
export const analyzeRecordProjection = async (executeInTransaction: (statement: string) => Promise<unknown>) => {
  await executeInTransaction("SET LOCAL default_statistics_target = 10");
  await executeInTransaction("ANALYZE records");
};

// Extension activation may add indexes after the startup pass, without writing any records.
// Collect missing expression statistics together on the next maintenance tick.
export const analyzeMissingRecordStatistics = async (db: PGlite) => {
  const { rows } = await db.query(`
    SELECT 1 FROM pg_statistic_ext s
    WHERE s.stxrelid = to_regclass('records')
      AND NOT EXISTS (SELECT 1 FROM pg_statistic_ext_data d WHERE d.stxoid = s.oid)
    LIMIT 1`);
  if (!rows.length) return;
  if (!(await db.query("SELECT 1 FROM records LIMIT 1")).rows.length) return;
  await db.transaction((tx) => analyzeRecordProjection((statement) => tx.exec(statement)));
};
