import { type SQLWrapper, sql } from "drizzle-orm";
import type { NativeRecordSources, OrderedRecord } from "pstdio-sync/records";
import type { Json, StorageRecord } from "pstdio-sync-contracts";
import { decodeOrderedJson, encodeOrderedJson } from "./ordered-sql";
import { decodeProjectionValue, encodeProjectionValue } from "./record-projection-codec";

interface RecordBodyLayout {
  keys: string[];
  extra: Record<string, Json>;
  nativeLifetimes: Record<string, Json>;
}
type BodyOrder = [string[], string[]][];
interface RecordMetadata {
  order: BodyOrder;
  stamps: [string, string][];
  texts?: OrderedRecord["texts"];
  body: RecordBodyLayout | { literal: Json };
}
export interface CanonicalRecordRow {
  record_id: string;
  deleted: boolean;
  value: Json;
  asset: unknown;
  shared: unknown;
  native_sources: unknown;
  record_lifetime: string;
  meta: Json;
  base: Uint8Array | null;
}
const channels = new Set(["value", "asset", "shared", "nativeSources"]);
const object = (value: Json): value is Record<string, Json> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const bodyOrder = (value: Json, path: string[] = [], order: BodyOrder = []) => {
  if (Array.isArray(value))
    value.forEach((item, index) => {
      bodyOrder(item, [...path, String(index)], order);
    });
  else if (object(value)) {
    order.push([path, Object.keys(value)]);
    for (const [key, item] of Object.entries(value)) bodyOrder(item, [...path, key], order);
  }
  return order;
};
const restoreBodyOrder = (value: Json, input: BodyOrder) => {
  const orders = new Map(input.map(([path, keys]) => [JSON.stringify(path), keys]));
  const restore = (value: Json, path: string[]): Json => {
    if (Array.isArray(value)) return value.map((item, index) => restore(item, [...path, String(index)]));
    if (!object(value)) return value;
    return Object.fromEntries(
      (orders.get(JSON.stringify(path)) ?? Object.keys(value)).map((key) => [
        key,
        restore(value[key]!, [...path, key]),
      ]),
    );
  };
  return restore(value, []);
};

export const orderedRecordMetadata = (record: OrderedRecord) => {
  const body = object(record.value) ? record.value : {};
  const sources = object(body.nativeSources ?? null) ? (body.nativeSources as Record<string, Json>) : {};
  const nativeLifetimes = Object.fromEntries(
    Object.entries(sources).flatMap(([key, source]) =>
      object(source) && Object.hasOwn(source, "lifetime") ? [[key, source.lifetime!]] : [],
    ),
  );
  const metadata: RecordMetadata = {
    order: bodyOrder(record.value),
    stamps: Object.entries(record.stamps),
    ...(record.texts === undefined ? {} : { texts: record.texts }),
    body: object(record.value)
      ? {
          keys: Object.keys(body),
          extra: Object.fromEntries(
            Object.entries(body).filter(
              ([key, value]) => !channels.has(key) || (key === "nativeSources" && !object(value)),
            ),
          ),
          nativeLifetimes,
        }
      : { literal: record.value },
  };
  return encodeProjectionValue(metadata as unknown as Json);
};

/** Keep a settled body once, in its query columns. Private number carriers and original
 * channel presence are canonical metadata; they must not disappear in a public projection. */
export const stableRecordColumns = (record: OrderedRecord) => {
  const body = object(record.value) ? record.value : {};
  const sources = object(body.nativeSources ?? null) ? (body.nativeSources as Record<string, Json>) : {};
  return {
    deleted: record.deleted,
    // Deleted rows hide these columns at the public boundary. Quiet compaction moves
    // the sole canonical body into private files while preserving restore-without-replacement.
    value: encodeProjectionValue(body.value ?? null),
    asset: encodeProjectionValue(body.asset ?? null) as StorageRecord["asset"],
    shared: encodeProjectionValue(body.shared ?? null) as StorageRecord["shared"],
    native_sources: encodeProjectionValue(
      Object.fromEntries(
        Object.entries(sources).map(([key, source]) => [key, { ...(source as object), lifetime: record.lifetime }]),
      ) as Json,
    ) as unknown as NativeRecordSources,
    record_lifetime: record.lifetime,
    meta: orderedRecordMetadata(record),
  };
};

export const isCompactedCanonicalMeta = (meta: Json) =>
  meta !== null && typeof meta === "object" && !Array.isArray(meta) && meta.retained === 1;

/** A pending overlay never becomes its own confirmed base. Null metadata represents
 * an optimistic creation that has not acquired a canonical occurrence. */
export const canonicalRecordFromRow = (row: CanonicalRecordRow): OrderedRecord | undefined => {
  if (row.base !== null) return decodeOrderedJson<OrderedRecord | null>(row.base) ?? undefined;
  if (row.meta === null) return;
  if (isCompactedCanonicalMeta(row.meta)) throw new Error("A compacted canonical record requires its retained file");
  const metadata = decodeProjectionValue(row.meta) as unknown as RecordMetadata;
  const layout = metadata.body;
  const value =
    "literal" in layout
      ? layout.literal
      : Object.fromEntries(
          layout.keys.map((key) => {
            if (Object.hasOwn(layout.extra, key)) return [key, layout.extra[key]!];
            if (key !== "nativeSources")
              return [key, decodeProjectionValue(row[key as "value" | "asset" | "shared"] as Json)];
            return [
              key,
              Object.fromEntries(
                Object.entries(decodeProjectionValue(row.native_sources as Json) as Record<string, Json>).map(
                  ([name, input]) => {
                    const source = { ...(input as Record<string, Json>) };
                    delete source.lifetime;
                    if (Object.hasOwn(layout.nativeLifetimes, name)) source.lifetime = layout.nativeLifetimes[name]!;
                    return [name, source];
                  },
                ),
              ),
            ];
          }),
        );
  return {
    recordId: row.record_id,
    value: restoreBodyOrder(value, metadata.order),
    deleted: row.deleted,
    lifetime: row.record_lifetime,
    stamps: Object.fromEntries(metadata.stamps),
    ...(metadata.texts === undefined ? {} : { texts: metadata.texts }),
  };
};

export const confirmedRecordBase = (record: OrderedRecord | undefined) => encodeOrderedJson(record ?? null);

/** An optimistic creation has a materialized row but an encoded-null confirmed base. */
export const canonicalRecordPredicate = (row: { meta: SQLWrapper; base: SQLWrapper }) =>
  sql`((${row.meta} IS NOT NULL AND ${row.base} IS NULL) OR (${row.base} IS NOT NULL AND ${row.base} <> ${encodeOrderedJson(null)}))`;
