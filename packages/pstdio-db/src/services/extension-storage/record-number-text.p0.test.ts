import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { recordNumberTextSql } from "./record-number-text";

const finiteNumbers = () => {
  const values = [
    -0,
    0,
    1,
    -1,
    1e-6,
    -1e-6,
    1e-7,
    -1e-7,
    1e20,
    1e21,
    -1e21,
    1e23,
    0.0000010000000000000002,
    1000000000000000100,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
  ];
  const view = new DataView(new ArrayBuffer(8));
  let state = 0x12345678;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  for (let index = 0; index < 2000; index++) {
    view.setUint32(0, next());
    view.setUint32(4, next());
    const value = view.getFloat64(0);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
};

test("SQL scalar text matches JavaScript across decimal boundaries and deterministic random doubles", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const values = finiteNumbers();
    const result = await f.db.execute(sql`
      SELECT ${recordNumberTextSql(sql`item`)} AS text
      FROM jsonb_array_elements(${JSON.stringify(values)}::jsonb) WITH ORDINALITY AS numbers(item, position)
      ORDER BY position
    `);
    expect(result.rows.map((row) => row.text)).toEqual(values.map(String));
  } finally {
    await f.close();
  }
});

test("record projections retain the exact JSON decimal before scalar text matching", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const records = createDocumentStorageDBService(f.db).open({
      owner: { workbenchId: f.projectAId, extensionId: "ext.example" },
    }).records;
    await records.commit({
      operationId: "numbers",
      edits: [1e23, 1e-7, 1000000000000000100, Number.MIN_VALUE].map((value, index) => ({
        recordId: String(index),
        replace: { value },
      })),
    });
    const result = await f.db.execute(sql`
      SELECT value ->> 'value' AS decimal FROM storage_current_records
      WHERE workbench_id = ${f.projectAId} ORDER BY record_id
    `);
    expect(result.rows.map((row) => row.decimal)).toEqual([
      "100000000000000000000000",
      "0.0000001",
      "1000000000000000100",
      `0.${"0".repeat(323)}5`,
    ]);
  } finally {
    await f.close();
  }
});
