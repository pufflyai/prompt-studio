import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { compareQueryValues, validateIndexes } from "pstdio-sync/records";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { analyzeRecordProjection } from "../../db/record-projection-statistics";
import { storage_current_records as current } from "../../db/schemas.pg";
import { traceStorageQuery } from "./query-trace";
import { retainDateFormatIndexes } from "./record-date-format";
import { derivedQueryChanges, rebuildDerivedQueryValues } from "./record-derived-fields";
import { formatDatabasePrefix } from "./record-format-key";
import { dropRecordIndexes, installRecordIndex, recordIndexName } from "./record-index-lifecycle";
import { deleteRecordIndexRows, recordIndexRows as indexes } from "./record-index-rows";
import { decodeProjectionValue } from "./record-projection-codec";
import type { StorageDiagnostics } from "./storage-diagnostics";
import { ensureStorageOwner, storageOwnerKey } from "./storage-owner-key";

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
  definitions: StorageRecordIndex[],
  statistics: "immediate" | "maintenance",
  diagnostics?: StorageDiagnostics,
) => {
  const scope = and(eq(indexes.owner_id, storageOwnerKey(owner)))!;
  traceStorageQuery("indexes-start", definitions.map(({ name }) => name).join(","));
  validateIndexes(definitions);
  const publicDesired = orderDefinitions(structuredClone(definitions));
  await db.transaction(async (tx) => {
    const ownerId = await ensureStorageOwner(tx, owner);
    const coreOwnerId = publicDesired.some((index) => index.identity)
      ? await ensureStorageOwner(tx, { ...owner, extensionId: "pstdio" })
      : null;
    const names = new Map(
      await Promise.all(
        publicDesired.map(
          async (index) => [index.name, await recordIndexName({ ...owner, ownerId, coreOwnerId }, index)] as const,
        ),
      ),
    );
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
      await deleteRecordIndexRows(tx, removed);
    }
    await rebuildDerivedQueryValues(tx, owner, derivedQueryChanges(installed, desired), diagnostics);
    const saved = new Map(previous.map((row) => [row.name, row.database_name]));
    for (const index of publicDesired)
      if (saved.get(index.name) !== names.get(index.name)) await installRecordIndex(tx, owner, index);
    // Commands can immediately query a new index on existing data. Catalog activation
    // admits many owners at once and leaves their shared statistics to maintenance.
    if (statistics === "immediate" && publicDesired.some((index) => saved.get(index.name) !== names.get(index.name))) {
      const [row] = await tx
        .select({ id: current.record_id })
        .from(current)
        .where(and(eq(current.owner_id, storageOwnerKey(owner))))
        .limit(1);
      if (row) await analyzeRecordProjection((statement) => tx.execute(sql.raw(statement)));
    }
  });
};
