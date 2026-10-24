import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { resolvePgliteOptions } from "./connection.pglite";
import { openPglite } from "./open-pglite";
import { prepareCurrentPgliteHome } from "./pglite-upgrade";

test("source memory creation loads full ICU only for the active engine", async () => {
  const runtime = await resolvePgliteOptions([]);
  let fullDataReads = 0;
  class CountedLocaleData extends Blob {
    async arrayBuffer() {
      fullDataReads++;
      return super.arrayBuffer();
    }
  }
  const db = await openPglite(":memory:", { ...runtime, icuDataDir: new CountedLocaleData([runtime.icuDataDir]) });
  try {
    await db.waitReady;
    expect(fullDataReads).toBe(1);
    await db.exec(
      "create temp table labels(v text);create collation pg_temp.sv(provider=icu,locale='sv-SE-u-kn-true-ks-level1',deterministic=false)",
    );
    const labels = ["Item 10", "Item 2", "ä", "z"];
    const result = await db.query<{ v: string }>(
      "select v from unnest($1::text[]) with ordinality t(v,n) order by v collate pg_temp.sv,n",
      [labels],
    );
    expect(result.rows.map(({ v }) => v)).toEqual(
      [...labels].sort(new Intl.Collator("sv-SE", { numeric: true, sensitivity: "base" }).compare),
    );
  } finally {
    await db.close();
  }
});

test("first creation loads runtime assets once for the active engine and supports query-local collations", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-source-initialization-"));
  const path = join(root, "database");
  const runtime = await resolvePgliteOptions([]);
  let runtimeDataReads = 0;
  class CountedRuntimeData extends Blob {
    async arrayBuffer() {
      runtimeDataReads++;
      return super.arrayBuffer();
    }
  }
  let fullDataReads = 0;
  class CountedLocaleData extends Blob {
    async arrayBuffer() {
      fullDataReads++;
      return super.arrayBuffer();
    }
  }
  const packageRoot = dirname(Bun.resolveSync("@electric-sql/pglite/package.json", import.meta.dir));
  const options = {
    ...runtime,
    fsBundle: new CountedRuntimeData([Bun.file(join(packageRoot, "dist/pglite.data"))]),
    icuDataDir: new CountedLocaleData([runtime.icuDataDir]),
  };
  try {
    await prepareCurrentPgliteHome({ activePath: path, runtime: options, embedded: [], onImageRestored: () => {} });
    expect(fullDataReads).toBe(0);
    expect(runtimeDataReads).toBe(0);
    const db = await openPglite(path, options);
    try {
      await db.waitReady;
      expect(fullDataReads).toBe(1);
      expect(runtimeDataReads).toBe(1);
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
