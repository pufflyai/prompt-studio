import { expect, test } from "bun:test";
import { type OrderedRecord, observeOrderedRecord } from "pstdio-sync/records";
import { canonicalJson } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { canonicalRecordFromRow, stableRecordColumns } from "./ordered-record-row";
import { encodeOrderedJson } from "./ordered-sql";

const record = (value: OrderedRecord["value"]): OrderedRecord => ({
  recordId: "card",
  value,
  deleted: false,
  lifetime: "lifetime",
  stamps: { "": "initial", "/value/title": "initial" },
});

test("a stable record row preserves channel presence, private numbers and every public JSON string", async () => {
  const input = record(
    JSON.parse(
      '{"value":{"__proto__":{"literal":true},"title":"a\\u0000b\\ud800","配列":[1,null]},"asset":null,"numberHistory":[{"prefix":"PS","value":9}],"numberAliases":[]}',
    ),
  );
  const row = stableRecordColumns(input);
  // Reorder object keys independently of the original canonical bytes.
  const transported = JSON.parse(canonicalJson(row as never));
  const restored = canonicalRecordFromRow({ ...transported, record_id: input.recordId, base: null });
  expect(restored).toEqual(input);
  expect(JSON.parse(await observeOrderedRecord(restored))).toEqual(JSON.parse(await observeOrderedRecord(input)));
  expect(Object.hasOwn(restored!.value as object, "shared")).toBe(false);
});

test("a tombstone keeps one hidden body for an explicit restore and native bindings retain original lifetimes", () => {
  const input = {
    ...record({
      value: { title: "restore me" },
      nativeSources: {
        first: { field: "/title" },
        second: { asset: true, lifetime: "original" },
      },
    }),
    deleted: true,
  };
  const row = stableRecordColumns(input);
  expect(row.value).toEqual({ title: "restore me" });
  expect(canonicalRecordFromRow({ ...row, record_id: input.recordId, base: null })).toEqual(input);
});

test("a pending projection reads its confirmed base and an optimistic creation has no confirmed record", () => {
  const confirmed = record({ value: { title: "confirmed" } });
  const optimistic = record({ value: { title: "pending" } });
  const row = stableRecordColumns(optimistic);
  expect(canonicalRecordFromRow({ ...row, record_id: "card", base: encodeOrderedJson(confirmed) })).toEqual(confirmed);
  expect(canonicalRecordFromRow({ ...row, record_id: "card", meta: null, base: null })).toBeUndefined();
  expect(canonicalRecordFromRow({ ...row, record_id: "card", base: encodeOrderedJson(null) })).toBeUndefined();
});

test("canonical null and non-wrapper states survive without synthesizing channels", () => {
  for (const value of [null, ["literal", 3], false, "literal", { arbitrary: "private" }] as const) {
    const input = record(value as OrderedRecord["value"]);
    expect(canonicalRecordFromRow({ ...stableRecordColumns(input), record_id: input.recordId, base: null })).toEqual(
      input,
    );
  }
});

test("canonical native source originals and text history survive actual PostgreSQL JSONB", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const input: OrderedRecord = {
      ...record({
        value: { longer: { longerChild: 1, a: 2 }, title: "a\u0000b\ud800" },
        nativeSources: {
          ["a".repeat(64)]: { field: "/title", original: "a\u0000b\ud800", lifetime: "old\u0000lifetime" },
        },
      }),
      texts: {
        "/value/title": { state: "AA==", seed: "seed", pending: [{ operationId: "pending", fingerprint: "identity" }] },
      },
    };
    const row = { ...stableRecordColumns(input), record_id: input.recordId, base: null };
    const { rows } = await connection.pglite.query<{ row: typeof row }>("SELECT $1::jsonb AS row", [
      JSON.stringify(row),
    ]);
    const restored = canonicalRecordFromRow(rows[0]!.row);
    expect(restored).toEqual(input);
    expect(await observeOrderedRecord(restored)).toBe(await observeOrderedRecord(input));
  } finally {
    await connection.close();
  }
});

test("a settled row preserves the exact observation string when stamp keys have insertion order", async () => {
  const input = {
    ...record({ value: { title: "unchanged" } }),
    stamps: { "": "root", "/value/long-title": "first", "/value/a": "later" },
  };
  const transported = JSON.parse(canonicalJson(stableRecordColumns(input) as never));
  const restored = canonicalRecordFromRow({ ...transported, record_id: input.recordId, base: null });
  expect(await observeOrderedRecord(restored)).toBe(await observeOrderedRecord(input));
});

test("settled metadata preserves recursive observation order through encoded JSONB objects", async () => {
  const input = {
    ...record(
      JSON.parse(
        '{"value":{"longerKey":{"longerChild":1,"a":2},"a":[{"longerLeaf":3,"":4,"__proto__":5}],"0":"number"},"privateCarrier":{"longerPrivate":6,"a":7}}',
      ),
    ),
    stamps: { "": "root" },
  };
  const row = JSON.parse(canonicalJson(stableRecordColumns(input) as never));
  const restored = canonicalRecordFromRow({ ...row, record_id: input.recordId, base: null });
  expect(await observeOrderedRecord(restored)).toBe(await observeOrderedRecord(input));
  expect(restored).toEqual(input);
});
