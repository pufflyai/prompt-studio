import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { compareQueryValues, validateIndexes } from "pstdio-sync/records";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_indexes as indexes } from "../../db/schemas.pg";
import { traceStorageQuery } from "./query-trace";
import { retainDateFormatIndexes } from "./record-date-format";
import { derivedQueryChanges, rebuildDerivedQueryValues } from "./record-derived-fields";
import { formatDatabasePrefix } from "./record-format-key";
import { dropRecordIndexes, installRecordIndex, recordIndexName } from "./record-index-lifecycle";
import { decodeProjectionValue } from "./record-projection-codec";
import type { StorageDiagnostics } from "./storage-diagnostics";

const orderDefinitions = (definitions: StorageRecordIndex[]) =>
  definitions.sort((left, right) => compareQueryValues(left.name, right.name));
const matchesRecordCatalog = (
  catalog: { name: string; databaseName: string }[],
  names: ReadonlyMap<string, string>,
) => {
  const declared = catalog.filter((row) => !row.databaseName.startsWith(formatDatabasePrefix));
  return declared.length === names.size && declared.every((row) => row.databaseName === names.get(row.name));
};

export const defineRecordIndexes = async (
  db: DbClient,
  owner: StorageOwner,
  scope: NonNullable<ReturnType<typeof and>>,
  definitions: StorageRecordIndex[],
  diagnostics?: StorageDiagnostics,
) => {
  traceStorageQuery("indexes-start", definitions.map(({ name }) => name).join(","));
  validateIndexes(definitions);
  const publicDesired = orderDefinitions(structuredClone(definitions));
  const names = new Map(
    await Promise.all(publicDesired.map(async (index) => [index.name, await recordIndexName(owner, index)] as const)),
  );
  await db.transaction(async (tx) => {
    // The physical name hashes the complete definition and implementation version.
    // Check that exact catalog identity before hydrating definitions needed only for replacement.
    const catalog = await tx
      .select({ name: indexes.name, databaseName: indexes.database_name })
      .from(indexes)
      .where(scope);
    if (matchesRecordCatalog(catalog, names)) return;
    const previous = await tx.select().from(indexes).where(scope);
    const decoded = previous.map((row) => ({
      index: decodeProjectionValue(row.definition as unknown as Json) as unknown as StorageRecordIndex,
      cached: row.database_name.startsWith(formatDatabasePrefix),
    }));
    const installed = orderDefinitions(decoded.map(({ index }) => index));
    const retained = await retainDateFormatIndexes(
      decoded.filter(({ cached }) => cached).map(({ index }) => index),
      publicDesired,
    );
    const desired = orderDefinitions([...publicDesired, ...retained]);
    const keptFormats = new Set(retained.map(({ name }) => name));
    const replaced = previous.filter((row) =>
      row.database_name.startsWith(formatDatabasePrefix)
        ? !keptFormats.has(row.name)
        : names.get(row.name) !== row.database_name,
    );
    if (replaced.length) {
      const removed = and(
        scope,
        inArray(
          indexes.name,
          replaced.map(({ name }) => name),
        ),
      )!;
      await dropRecordIndexes(tx, removed);
      await tx.delete(indexes).where(removed);
    }
    await rebuildDerivedQueryValues(tx, owner, derivedQueryChanges(installed, desired), diagnostics);
    const saved = new Map(previous.map((row) => [row.name, row.database_name]));
    for (const index of publicDesired)
      if (saved.get(index.name) !== names.get(index.name)) await installRecordIndex(tx, owner, index);
    // Projection maintenance collects statistics for all owners together. An ANALYZE here
    // would scan the shared projection for every extension admitted during startup.
  });
};
