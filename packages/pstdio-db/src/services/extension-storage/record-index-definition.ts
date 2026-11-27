import { isDeepStrictEqual } from "node:util";
import { and, eq, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { compareQueryValues, validateIndexes } from "pstdio-sync/records";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { traceStorageQuery } from "./query-trace";
import { retainDateFormatIndexes } from "./record-date-format";
import { derivedQueryChanges, rebuildDerivedQueryValues } from "./record-derived-fields";
import { formatDatabasePrefix } from "./record-format-key";
import {
  dropRecordIndexes,
  installRecordIndex,
  queryDefinitionName,
  recordIndexName,
  saveQueryDefinition,
} from "./record-index-lifecycle";
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

type Registration = "query" | "host-index";

const catalogNames = async (
  tx: DbClient,
  owner: StorageOwner,
  definitions: StorageRecordIndex[],
  kind: Registration,
) => {
  const ownerId = await ensureStorageOwner(tx, owner);
  const coreOwnerId =
    kind === "host-index" && definitions.some((index) => index.identity)
      ? await ensureStorageOwner(tx, { ...owner, extensionId: "pstdio" })
      : null;
  return new Map(
    await Promise.all(
      definitions.map(
        async (index) =>
          [
            index.name,
            kind === "host-index"
              ? await recordIndexName({ ...owner, ownerId, coreOwnerId }, index)
              : await queryDefinitionName(owner, ownerId, index),
          ] as const,
      ),
    ),
  );
};

// Defer removal of unchanged legacy indexes to quiet maintenance, including on first activation.
const keepLegacyTokens = (
  names: Map<string, string>,
  requested: StorageRecordIndex[],
  installed: { index: StorageRecordIndex; databaseName: string }[],
) => {
  const byName = new Map(requested.map((index) => [index.name, index]));
  for (const { index, databaseName } of installed)
    if (databaseName.startsWith("storage_query_") && isDeepStrictEqual(byName.get(index.name), index))
      names.set(index.name, databaseName);
};

export const defineRecordIndexes = async (
  db: DbClient,
  owner: StorageOwner,
  definitions: StorageRecordIndex[],
  kind: Registration,
  diagnostics?: StorageDiagnostics,
) => {
  const scope = and(eq(indexes.owner_id, storageOwnerKey(owner)))!;
  traceStorageQuery("indexes-start", definitions.map(({ name }) => name).join(","));
  validateIndexes(definitions);
  const publicDesired = orderDefinitions(structuredClone(definitions));
  await db.transaction(async (tx) => {
    const names = await catalogNames(tx, owner, publicDesired, kind);
    // The catalog token identifies both the definition and its installation mode.
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
      databaseName: row.database_name,
    }));
    if (kind === "query") keepLegacyTokens(names, publicDesired, decoded);
    if (matchesRecordCatalog(catalog, names)) return;
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
    const install = kind === "host-index" ? installRecordIndex : saveQueryDefinition;
    for (const index of publicDesired)
      if (saved.get(index.name) !== names.get(index.name)) await install(tx, owner, index);
  });
};
