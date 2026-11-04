import type { Json, StorageRecord } from "pstdio-sync-contracts";
import type { NativeRecordSources } from "./native-record-source";
import { type OrderedRecord, observeOrderedRecord } from "./ordered-operation";

export type OrderedBody = {
  value: Json;
  asset: StorageRecord["asset"];
  shared: StorageRecord["shared"];
  nativeSources: NativeRecordSources;
};
export const orderedBody = (record: OrderedRecord) => {
  const body = record.value as Partial<OrderedBody>;
  return {
    value: body.value ?? null,
    asset: body.asset ?? null,
    shared: body.shared ?? null,
    nativeSources: body.nativeSources ?? {},
  };
};
export const orderedProjection = async (record: OrderedRecord) => {
  const body = structuredClone(orderedBody(record));
  return {
    recordId: record.recordId,
    exists: true,
    deleted: record.deleted,
    value: record.deleted ? null : body.value,
    asset: record.deleted ? null : body.asset,
    shared: record.deleted ? null : body.shared,
    revision: await observeOrderedRecord(record),
    recordLifetime: record.lifetime,
    nativeSources: record.deleted
      ? {}
      : Object.fromEntries(
          Object.entries(body.nativeSources).map(([key, source]) => [key, { ...source, lifetime: record.lifetime }]),
        ),
  };
};
