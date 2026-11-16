import type { StorageOwner } from "pstdio-sync";
import { type OrderedRecord, orderedBody } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import type { NativeProjectedRecord } from "./native-record-projection";
import {
  type OrderedFieldMarker,
  orderedFieldMarkerId,
  readOrderedMarkers,
  saveOrderedMarker,
} from "./ordered-native-metadata";
import type { OrderedTransaction } from "./ordered-sql";

interface FieldVersion {
  record: OrderedRecord;
  key: string;
  field: string;
  present: boolean;
  previouslyPresent: boolean;
}

const refreshFieldVersions = async (tx: OrderedTransaction, owner: StorageOwner, fields: FieldVersion[]) => {
  const markers = await readOrderedMarkers<OrderedFieldMarker>(
    tx,
    owner,
    fields.map(({ key }) => orderedFieldMarkerId(key)),
  );
  for (const { record, key, field, present, previouslyPresent } of fields) {
    const id = orderedFieldMarkerId(key);
    const marker = markers.get(id);
    const state = record.texts?.[`/value${field}`];
    const active = !record.deleted && present && state !== undefined;
    const version = await fingerprint({ lifetime: record.lifetime, active, state: state?.state ?? null });
    if (marker?.value.textVersion === version) continue;
    const generation = !active && previouslyPresent ? version : marker?.value.generation;
    const value = {
      ...marker?.value,
      recordId: record.recordId,
      field,
      lifetime: record.lifetime,
      textVersion: version,
      generation,
    };
    await saveOrderedMarker(tx, owner, id, value);
    // Shared keys must observe the preceding write just as sequential point reads did.
    markers.set(id, { value });
  }
};

/** Native watchers use the same revision for ordinary commands, remote input and typing. */
export const refreshOrderedNativeVersions = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
  previous: Pick<NativeProjectedRecord, "recordId" | "nativeSources">[],
) => {
  const old = new Map(previous.map((record) => [record.recordId, record]));
  let batch: FieldVersion[] = [];
  for (const record of records) {
    const body = orderedBody(record);
    const before = old.get(record.recordId);
    for (const [key, source] of Object.entries({ ...before?.nativeSources, ...body.nativeSources })) {
      if (!("field" in source)) continue;
      batch.push({
        record,
        key,
        field: source.field,
        present: Object.hasOwn(body.nativeSources, key),
        previouslyPresent: Boolean(before?.nativeSources?.[key]),
      });
      if (batch.length === 100) {
        await refreshFieldVersions(tx, owner, batch);
        batch = [];
      }
    }
  }
  if (batch.length) await refreshFieldVersions(tx, owner, batch);
};
