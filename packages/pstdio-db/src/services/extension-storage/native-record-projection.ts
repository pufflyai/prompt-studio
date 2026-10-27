import { and, eq, sql } from "drizzle-orm";
import {
  isEmptyDocument,
  type NativeRecordSources,
  readTextDocumentSeed,
  type StorageOwner,
  setNativeFieldValue,
} from "pstdio-sync";
import { fingerprint, type Json, type StorageRecord } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { projects, storage_current_records, storage_record_projections } from "../../db/schemas.pg";
import { decodeProjectionValue, encodeProjectionValue } from "./record-projection-codec";
import { loadResourceDocuments } from "./resource-document-persistence";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type NativeProjectedRecord = StorageRecord & {
  recordLifetime?: string;
  nativeSources?: NativeRecordSources;
  nativeVersions?: Record<string, string>;
};
export const nativeDocumentId = (key: string) => JSON.stringify(["native-markdown", key]);

/** Record and text writes take this lock first so their shared SQL projections commit together. */
export const lockStorageProject = (tx: Transaction, projectId: string) =>
  tx.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).for("update");

export const readNativeTextIn = async (tx: Transaction, owner: StorageOwner, key: string) => {
  const id = nativeDocumentId(key);
  const { sources } = await loadResourceDocuments(tx, owner, [id]);
  const saved = sources.get(id);
  if (!saved) return undefined;
  const document = new Y.Doc();
  try {
    for (const state of saved.states) Y.applyUpdate(document, state);
    if (isEmptyDocument(document)) return undefined;
    await readTextDocumentSeed(document);
    return document.getText("content").toString();
  } finally {
    document.destroy();
  }
};

const materialized = async (record: NativeProjectedRecord, texts: Map<string, string>) => {
  if (!Object.keys(record.nativeSources ?? {}).length || record.deleted) return record;
  const value = structuredClone(record.value) as Record<string, Json>;
  const nativeVersions = { ...record.nativeVersions };
  for (const [key, source] of Object.entries(record.nativeSources!)) {
    const text = texts.get(key);
    if (text !== undefined) {
      if ("field" in source) setNativeFieldValue(value, source.field, text);
      nativeVersions[key] = await fingerprint(text);
    }
  }
  const { asset, shared, deleted, nativeSources } = record;
  return {
    ...record,
    value,
    nativeVersions,
    revision: await fingerprint({ value, asset, shared, deleted, nativeSources: nativeSources ?? {}, nativeVersions }),
  };
};

export const projectNativeRecordText = async (tx: Transaction, owner: StorageOwner, record: NativeProjectedRecord) => {
  const texts = new Map<string, string>();
  for (const key of Object.keys(record.nativeSources ?? {})) {
    const text = await readNativeTextIn(tx, owner, key);
    if (text !== undefined) texts.set(key, text);
  }
  return materialized(record, texts);
};

/** Only indexed bindings for this standalone text are refreshed; no record documents are loaded. */
export const refreshNativeRecordText = async (tx: Transaction, owner: StorageOwner, key: string, content: string) => {
  const rows = await tx
    .select()
    .from(storage_current_records)
    .where(
      and(
        eq(storage_current_records.workbench_id, owner.workbenchId),
        eq(storage_current_records.extension_id, owner.extensionId),
        eq(storage_current_records.deleted, false),
        sql`${storage_current_records.native_sources} ? ${key}`,
      ),
    );
  let changed = 0;
  for (const row of rows) {
    const record = await materialized(
      {
        recordId: row.record_id,
        exists: true,
        deleted: row.deleted,
        value: decodeProjectionValue(row.value),
        asset: decodeProjectionValue(row.asset) as StorageRecord["asset"],
        shared: decodeProjectionValue(row.shared) as StorageRecord["shared"],
        revision: row.revision,
        nativeSources: row.native_sources,
        nativeVersions: row.native_versions,
      },
      new Map([[key, content]]),
    );
    if (record.revision === row.revision) continue;
    await tx
      .update(storage_current_records)
      .set({
        value: encodeProjectionValue(record.value),
        revision: record.revision,
        native_versions: record.nativeVersions ?? {},
      })
      .where(
        and(
          eq(storage_current_records.workbench_id, owner.workbenchId),
          eq(storage_current_records.extension_id, owner.extensionId),
          eq(storage_current_records.record_id, row.record_id),
        ),
      );
    changed++;
  }
  if (changed)
    await tx
      .update(storage_record_projections)
      .set({ revision: sql`${storage_record_projections.revision} + 1` })
      .where(
        and(
          eq(storage_record_projections.workbench_id, owner.workbenchId),
          eq(storage_record_projections.extension_id, owner.extensionId),
        ),
      );
  return changed;
};
