import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePgliteOptions } from "./connection.pglite";
import { openPglite } from "./open-pglite";
import { prepareCurrentPgliteHome } from "./pglite-upgrade";

test("source creation loads full ICU once for the active engine and supports query-local collations", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-source-initialization-"));
  const path = join(root, "database");
  const runtime = await resolvePgliteOptions([]);
  let fullDataReads = 0;
  class CountedLocaleData extends Blob {
    async arrayBuffer() {
      fullDataReads++;
      return super.arrayBuffer();
    }
  }
  const options = { ...runtime, icuDataDir: new CountedLocaleData([runtime.icuDataDir]) };
  try {
    await prepareCurrentPgliteHome({ activePath: path, runtime: options, embedded: [], onImageRestored: () => {} });
    expect(fullDataReads).toBe(0);
    const db = await openPglite(path, options);
    try {
      await db.waitReady;
      expect(fullDataReads).toBe(1);
      expect(
        (
          await db.query(
            "select datcollate, datctype, datlocprovider from pg_database where datname = current_database()",
          )
        ).rows,
      ).toEqual([{ datcollate: "C", datctype: "C.UTF-8", datlocprovider: "c" }]);
      await db.exec(
        "create temp table locale_values(label text); create collation pg_temp.exact_locale(provider=icu,locale='sv-SE-u-kn-true-ks-level1',deterministic=false)",
      );
      const labels = ["ä", "z", "a", "Item 10", "Item 2", "ö", "A"];
      const result = await db.query<{ label: string }>(
        "select label from unnest($1::text[]) with ordinality t(label,position) order by label collate pg_temp.exact_locale, position",
        [labels],
      );
      expect(result.rows.map(({ label }) => label)).toEqual(
        [...labels].sort(new Intl.Collator("sv-SE", { numeric: true, sensitivity: "base" }).compare),
      );
    } finally {
      await db.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
