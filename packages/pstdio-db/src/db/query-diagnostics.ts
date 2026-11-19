import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { query as queryTemplate } from "@electric-sql/pglite/template";
import { finishRuntimeOperation, runRuntimeOperation, startRuntimeOperation } from "pstdio-diagnostics";

const statementKinds = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "WITH",
  "CREATE",
  "ALTER",
  "DROP",
  "TRUNCATE",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "RELEASE",
  "SET",
  "SHOW",
  "RESET",
  "EXPLAIN",
  "ANALYZE",
  "VACUUM",
  "CALL",
  "DO",
  "COPY",
  "GRANT",
  "REVOKE",
]);

const queryMeasurements = (statement: string) => {
  const kind = /^\s*(\w+)/.exec(statement)?.[1]?.toUpperCase() ?? "UNKNOWN";
  return {
    statement: statementKinds.has(kind) ? kind : "UNKNOWN",
    queryHash: createHash("sha256").update(statement).digest("hex"),
  };
};

const startQuery = (statement: string) => {
  const operation = startRuntimeOperation("database.query");
  if (!operation) return;
  operation.measurements = queryMeasurements(statement);
  return operation;
};

/** Observe before the engine queue so the caller and asynchronous origin survive queueing. */
const observeSqlQueries = <Database extends Pick<PGlite, "query" | "exec">>(database: Database) => {
  const query = database.query;
  database.query = function (this: Database, ...args: Parameters<typeof query>) {
    const operation = startQuery(args[0]);
    if (!operation) return query.apply(this, args);
    return runRuntimeOperation(operation, () => query.apply(this, args)).then(
      (result) => {
        finishRuntimeOperation(operation, { rows: result.rows.length, failed: false });
        return result;
      },
      (error: unknown) => {
        finishRuntimeOperation(operation, { failed: true });
        throw error;
      },
    );
  } as typeof query;
  const exec = database.exec;
  database.exec = function (this: Database, ...args: Parameters<typeof exec>) {
    const operation = startQuery(args[0]);
    if (!operation) return exec.apply(this, args);
    return runRuntimeOperation(operation, () => exec.apply(this, args)).then(
      (results) => {
        finishRuntimeOperation(operation, {
          rows: results.reduce((rows, result) => rows + result.rows.length, 0),
          failed: false,
        });
        return results;
      },
      (error: unknown) => {
        finishRuntimeOperation(operation, { failed: true });
        throw error;
      },
    );
  } as typeof exec;
  return database;
};

export const observePgliteQueries = (database: PGlite) => {
  observeSqlQueries(database);
  const transaction = database.transaction;
  database.transaction = function (this: PGlite, callback: Parameters<typeof transaction>[0]) {
    return transaction.call(this, (handle) => {
      const transactionQuery = handle.query;
      observeSqlQueries(handle);
      // Transaction.sql closes over its original query function, so observing handle.query alone misses it.
      const sql = handle.sql;
      handle.sql = function (this: typeof handle, ...args: Parameters<typeof sql>) {
        const operation = startRuntimeOperation("database.query");
        if (!operation) return sql.apply(this, args);
        return runRuntimeOperation(operation, async () => {
          try {
            const prepared = queryTemplate(...args);
            operation.measurements = queryMeasurements(prepared.query);
            const result = await transactionQuery.call(handle, prepared.query, prepared.params);
            finishRuntimeOperation(operation, { rows: result.rows.length, failed: false });
            return result;
          } catch (error) {
            finishRuntimeOperation(operation, { failed: true });
            throw error;
          }
        });
      } as typeof sql;
      return callback(handle);
    });
  } as typeof transaction;
  const execute = database.execProtocolRaw;
  database.execProtocolRaw = async function (this: PGlite, ...args: Parameters<typeof execute>) {
    const operation = startRuntimeOperation("database.execute");
    try {
      const result = await execute.apply(this, args);
      finishRuntimeOperation(operation, { bytes: result.byteLength, failed: false });
      return result;
    } catch (error) {
      finishRuntimeOperation(operation, { failed: true });
      throw error;
    }
  };
  return database;
};
