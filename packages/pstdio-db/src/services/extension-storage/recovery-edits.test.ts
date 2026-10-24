import { expect, test } from "bun:test";
import type { StorageRecord } from "pstdio-sync-contracts";
import { recoveryEdits } from "./recovery-edits";

const live = (recordId: string, value: StorageRecord["value"], extra: Partial<StorageRecord> = {}): StorageRecord => ({
  recordId,
  exists: true,
  revision: "r",
  value,
  asset: null,
  deleted: false,
  shared: null,
  ...extra,
});

test("restore edits bring back deleted records, remove later records, and replace changed values", () => {
  const current = [live("kept", "same"), live("changed", "after"), live("added", "later")];
  const saved = [live("kept", "same"), live("changed", "before"), live("deleted", "gone")];
  expect(recoveryEdits(current, saved)).toEqual({
    edits: [
      { recordId: "added", deleted: true },
      { recordId: "changed", replace: "before" },
      { recordId: "deleted", deleted: false, replace: "gone", asset: null },
    ],
    revived: true,
  });
});

test("restore edits rewrite shared text around the unchanged prefix and suffix", () => {
  const current = [live("note", null, { shared: { kind: "text", value: "Hello brave world" } })];
  const saved = [live("note", null, { shared: { kind: "text", value: "Hello world" } })];
  expect(recoveryEdits(current, saved).edits).toEqual([
    { recordId: "note", shared: [{ kind: "text.delete", index: 6, count: 6 }] },
  ]);
});

test("restore edits set and remove shared map keys and replace shared lists", () => {
  const current = [
    live("map", null, { shared: { kind: "map", value: { a: 1, b: 2 } } }),
    live("list", null, { shared: { kind: "list", value: [1, 2] } }),
  ];
  const saved = [
    live("map", null, { shared: { kind: "map", value: { a: 1, c: 3 } } }),
    live("list", null, { shared: { kind: "list", value: [3] } }),
  ];
  expect(recoveryEdits(current, saved).edits).toEqual([
    {
      recordId: "list",
      shared: [
        { kind: "list.delete", index: 0, count: 2 },
        { kind: "list.insert", index: 0, values: [3] },
      ],
    },
    {
      recordId: "map",
      shared: [
        { kind: "map.delete", key: "b" },
        { kind: "map.set", key: "c", value: 3 },
      ],
    },
  ]);
});

test("restore edits leave matching records untouched", () => {
  const asset = { sha256: "a".repeat(64), byteLength: 1, mediaType: "image/png" };
  const records = [live("same", { a: 1 }, { asset, shared: { kind: "text", value: "x" } })];
  expect(recoveryEdits(records, structuredClone(records))).toEqual({ edits: [], revived: false });
});

test("restore edits never split an emoji in shared text", () => {
  const current = [live("note", null, { shared: { kind: "text", value: "a😀b" } })];
  const saved = [live("note", null, { shared: { kind: "text", value: "a😃b" } })];
  expect(recoveryEdits(current, saved).edits).toEqual([
    {
      recordId: "note",
      shared: [
        { kind: "text.delete", index: 1, count: 2 },
        { kind: "text.insert", index: 1, text: "😃" },
      ],
    },
  ]);
});
