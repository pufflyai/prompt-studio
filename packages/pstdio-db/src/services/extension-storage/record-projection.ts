import { and, eq, ne, sql } from "drizzle-orm";
import { documentRecordTypes, type RecordType, readDocumentRecord } from "pstdio-sync";
import type * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records, storage_record_projections, storage_record_types } from "../../db/schemas.pg";
import type { DocumentAddress } from "./document-persistence";
import { encodeProjectionValue } from "./record-projection-codec";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Root = Y.AbstractType<unknown>;
const ownership = new WeakMap<Y.Doc, WeakMap<Root, string>>();

const rootType = (document: Y.Doc, type: RecordType) => {
  if (type.kind === "text") return document.getText(type.name);
  if (type.kind === "list") return document.getArray(type.name);
  return document.getMap(type.name);
};

export const trackRecordProjection = async (
  tx: Transaction,
  address: DocumentAddress,
  document: Y.Doc,
  initialize: boolean,
) => {
  const owner = { workbench_id: address.workbench_id, extension_id: address.extension_id };
  const ownerWhere = (
    table: typeof storage_current_records | typeof storage_record_projections | typeof storage_record_types,
  ) => and(eq(table.workbench_id, owner.workbench_id), eq(table.extension_id, owner.extension_id));
  const [projection] = await tx.select().from(storage_record_projections).where(ownerWhere(storage_record_projections));
  if (initialize && !projection) await tx.insert(storage_record_projections).values({ ...owner, revision: 0 });
  let types = ownership.get(document);
  if (!types) {
    types = new WeakMap();
    for (const row of await tx.select().from(storage_record_types).where(ownerWhere(storage_record_types)))
      types.set(rootType(document, { name: row.type_name, kind: row.type_kind }) as Root, row.record_id);
    ownership.set(document, types);
  }
  const recordTypes = types;
  const records = document.getMap<string>("records");
  const deleted = document.getMap("deleted");
  const affected = new Set<string>();
  const markAll = () => {
    for (const id of records.keys()) affected.add(id);
    for (const id of deleted.keys()) affected.add(id);
  };
  if (initialize && !projection) markAll();
  let rebuild = false;
  const changed = (transaction: Y.Transaction) => {
    for (const [type, keys] of transaction.changed) {
      if ((type as unknown) === records || (type as unknown) === deleted) {
        for (const key of keys) if (key !== null) affected.add(key);
      } else {
        const id = recordTypes.get(type as Root);
        if (id !== undefined) affected.add(id);
      }
    }
  };
  document.on("afterTransaction", changed);
  return {
    rebuild: async () => {
      rebuild = true;
      markAll();
    },
    stop: () => document.off("afterTransaction", changed),
    async persist(revision: number) {
      if (!projection && !initialize && !rebuild) return;
      if (rebuild) {
        await tx
          .insert(storage_record_projections)
          .values({ ...owner, revision })
          .onConflictDoNothing();
        await tx.delete(storage_current_records).where(ownerWhere(storage_current_records));
        await tx.delete(storage_record_types).where(ownerWhere(storage_record_types));
      }
      let projected = 0;
      const ids = [...affected];
      for (let offset = 0; offset < ids.length; offset += 512) {
        const records = await Promise.all(
          ids.slice(offset, offset + 512).map((id) => readDocumentRecord(document, id)),
        );
        const rows = records
          .filter((record) => record.exists)
          .map((record) => ({
            ...owner,
            record_id: record.recordId,
            deleted: record.deleted,
            value: encodeProjectionValue(record.value),
            asset: encodeProjectionValue(record.asset) as typeof record.asset,
            shared: encodeProjectionValue(record.shared) as typeof record.shared,
            revision: record.revision,
          }));
        if (!rows.length) continue;
        const changed = await tx
          .insert(storage_current_records)
          .values(rows)
          .onConflictDoUpdate({
            target: [
              storage_current_records.workbench_id,
              storage_current_records.extension_id,
              storage_current_records.record_id,
            ],
            set: {
              deleted: sql`excluded.deleted`,
              value: sql`excluded.value`,
              asset: sql`excluded.asset`,
              shared: sql`excluded.shared`,
              revision: sql`excluded.revision`,
            },
            setWhere: ne(storage_current_records.revision, sql`excluded.revision`),
          })
          .returning({ id: storage_current_records.record_id });
        projected += changed.length;
        const owned = records.flatMap((record) =>
          documentRecordTypes(document, record.recordId).map((type) => ({ ...type, recordId: record.recordId })),
        );
        for (let typeOffset = 0; typeOffset < owned.length; typeOffset += 2_000) {
          await tx
            .insert(storage_record_types)
            .values(
              owned.slice(typeOffset, typeOffset + 2_000).map((type) => ({
                ...owner,
                record_id: type.recordId,
                type_name: type.name,
                type_kind: type.kind,
              })),
            )
            .onConflictDoNothing();
        }
        for (const type of owned) recordTypes.set(rootType(document, type) as Root, type.recordId);
      }
      await tx.update(storage_record_projections).set({ revision }).where(ownerWhere(storage_record_projections));
      return projected;
    },
  };
};
