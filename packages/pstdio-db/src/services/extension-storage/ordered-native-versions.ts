import type { StorageOwner } from "pstdio-sync";
import { type OrderedRecord, orderedBody } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import type { NativeProjectedRecord } from "./native-record-projection";
import {
  type OrderedFieldMarker,
  orderedFieldMarkerId,
  readOrderedMarker,
  saveOrderedMarker,
} from "./ordered-native-metadata";
import type { OrderedTransaction } from "./ordered-sql";

/** Native watchers use the same revision for ordinary commands, remote input and typing. */
export const refreshOrderedNativeVersions = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
  previous: NativeProjectedRecord[],
) => {
  const old = new Map(previous.map((record) => [record.recordId, record]));
  for (const record of records) {
    const body = orderedBody(record);
    const before = old.get(record.recordId);
    for (const [key, source] of Object.entries({ ...before?.nativeSources, ...body.nativeSources })) {
      if (!("field" in source)) continue;
      const id = orderedFieldMarkerId(key);
      const marker = await readOrderedMarker<OrderedFieldMarker>(tx, owner, id);
      const state = record.texts?.[`/value${source.field}`];
      const active = !record.deleted && Object.hasOwn(body.nativeSources, key) && state !== undefined;
      const version = await fingerprint({ lifetime: record.lifetime, active, state: state?.state ?? null });
      if (marker?.value.textVersion === version) continue;
      const generation = !active && before?.nativeSources?.[key] ? version : marker?.value.generation;
      await saveOrderedMarker(tx, owner, id, {
        ...marker?.value,
        recordId: record.recordId,
        field: source.field,
        lifetime: record.lifetime,
        textVersion: version,
        generation,
      });
    }
  }
};
