// Each registered expression statistic evaluates JSON for every sampled row on the
// PGlite host thread. Target 10 samples about 3,000 rows across the shared table.
export const analyzeRecordProjection = async (executeInTransaction: (statement: string) => Promise<unknown>) => {
  await executeInTransaction("SET LOCAL default_statistics_target = 10");
  await executeInTransaction("ANALYZE storage_current_records");
};
