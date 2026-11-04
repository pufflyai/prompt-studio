import type { DbClient } from "../../db/connection.pglite";
import { createProjectionStatistics } from "./projection-statistics";

const owners = new WeakMap<DbClient, ReturnType<typeof createProjectionStatistics>>();

/** Streams share one table and therefore one committed-change counter per connection. */
export const orderedLogStatistics = (db: DbClient) => {
  let statistics = owners.get(db);
  if (!statistics) {
    statistics = createProjectionStatistics(db, "storage_log_entries");
    owners.set(db, statistics);
  }
  return statistics;
};
