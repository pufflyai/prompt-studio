import { expect, test } from "bun:test";
import { types } from "@electric-sql/pglite";
import { openPglite } from "./open-pglite";

test("binary database values retain every byte, empty values, scalar nulls and array entries", async () => {
  const db = await openPglite(":memory:");
  try {
    const bytes = Uint8Array.from({ length: 65_536 }, (_, index) => index % 256);
    const empty = new Uint8Array();
    const { rows } = await db.query<{ bytes: Uint8Array; empty: Uint8Array; absent: null; values: Uint8Array[] }>(
      "SELECT $1::bytea AS bytes, $2::bytea AS empty, NULL::bytea AS absent, ARRAY[$1::bytea, $2::bytea] AS values",
      [bytes, empty],
    );
    expect(rows[0]?.bytes).toBeInstanceOf(Uint8Array);
    expect(rows[0]).toEqual({ bytes, empty, absent: null, values: [bytes, empty] });
    await expect(db.query("SELECT $1::bytea", ["not bytes"])).rejects.toThrow();
  } finally {
    await db.close();
  }
});

test("database binary conversion preserves caller type handlers", async () => {
  const db = await openPglite(":memory:", { parsers: { [types.INT4]: (value) => `integer:${value}` } });
  try {
    expect((await db.query("SELECT 42::integer AS value")).rows).toEqual([{ value: "integer:42" }]);
  } finally {
    await db.close();
  }
});
