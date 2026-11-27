import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { packIcu } from "../../scripts/pack-icu";
import { resolvePgliteOptions } from "./connection.pglite";
import { fullIcuData } from "./icu-data";

test("the bundled common data preserves every upstream resource and serves locale-specific collations", async () => {
  const upstream = Bun.file(
    join(dirname(Bun.resolveSync("@electric-sql/pglite-icu-full", import.meta.dir)), "icu.76.tgz"),
  );
  const resources = await new Bun.Archive(await upstream.bytes()).files();
  const packed = await packIcu(upstream);
  const body = Buffer.from(Bun.zstdDecompressSync(packed)).subarray(32);
  expect(body.readUInt32LE()).toBe(resources.size);
  const count = resources.size;
  for (let i = 0; i < count; i++) {
    const nameAt = body.readUInt32LE(4 + i * 8);
    const name = body.toString("ascii", nameAt, body.indexOf(0, nameAt));
    const dataAt = body.readUInt32LE(8 + i * 8);
    const source = resources.get(name)!;
    expect(body.subarray(dataAt, dataAt + source.size).equals(await source.bytes())).toBe(true);
    resources.delete(name);
  }
  expect(resources.size).toBe(0);
  const options = await resolvePgliteOptions([]);
  const db = await PGlite.create({
    ...options,
    icuDataDir: undefined,
    extensions: { fullIcuData: fullIcuData(new Blob([Uint8Array.from(packed)])) },
  });
  try {
    await db.exec(
      "CREATE COLLATION sv_full (provider=icu,locale='sv'); CREATE COLLATION de_full (provider=icu,locale='de')",
    );
    const result = await db.query(`SELECT 'z' COLLATE sv_full < 'ä' AS swedish, 'ä' COLLATE de_full < 'z' AS german`);
    expect(result.rows).toEqual([{ swedish: true, german: true }]);
  } finally {
    await db.close();
  }
});
