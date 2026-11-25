import assert from "node:assert/strict";
import { rename } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createTextLogOwnerFixture } from "pstdio-db/test-fixtures";

import { seedReleasedStorage, storageScale } from "./desktop-upgrade-storage.fixture";

const [action, home, profile = "history"] = process.argv.slice(2);
assert(home, "Supply an isolated test home");
assert(profile === "history" || profile === "storage", "Unknown upgrade profile");
const database = join(home, "pstdio.db");
const count = 90_000;

if (action === "seed") {
  const legacy = await createTextLogOwnerFixture(home);
  try {
    await legacy.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('upgrade-repro','Upgrade fixture','UP','2026-11-20T12:00:00Z','2026-11-20T12:00:00Z')`);
    if (profile === "storage") await seedReleasedStorage(legacy.pglite);
    else
      await legacy.pglite.exec(`INSERT INTO storage_personal_history (workbench_id,extension_id,device_id,kind,record_id,value,seed_id,pending_id)
      SELECT 'upgrade-repro','history','test-device','sessions','session-'||n,jsonb_build_object('id',n),'seed-'||n,'pending-'||n
      FROM generate_series(1,${count}) n;
      INSERT INTO storage_personal_history_sources
        (workbench_id,extension_id,source_id,kind,device_id,record_id,value,seed_id,entry_id,sequence,entry_index)
      SELECT workbench_id,extension_id,'test-device',kind,device_id,record_id,value,seed_id,'accepted-'||record_id,1701,7
      FROM storage_personal_history`);
  } finally {
    await legacy.close();
  }
  await rename(legacy.path, database);
} else if (action === "verify") {
  const require = createRequire(import.meta.url);
  const icu = join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
  const db = new PGlite(database, { database: "template1", username: "postgres", icuDataDir: Bun.file(icu) });
  try {
    const saved = await db.query("SELECT name FROM projects WHERE id='upgrade-repro'");
    assert.deepEqual(saved.rows, [{ name: "Verified upgrade" }]);
    if (profile === "storage") {
      const check = await db.query(`SELECT (SELECT count(*)::int FROM records) AS records,
        (SELECT count(*)::int FROM operations) AS operations, (SELECT count(*)::int FROM asset_transfers) AS transfers,
        (SELECT count(*)::int FROM projects) AS projects`);
      const { records, transfers, projects } = storageScale;
      assert.deepEqual(check.rows, [{ records, operations: 0, transfers, projects }]);
    } else {
      const { rows } = await db.query(`SELECT
      (SELECT count(*)::int FROM history_rows) AS history,
      (SELECT count(*)::int FROM history_sources) AS sources`);
      assert.deepEqual(rows, [{ history: count, sources: count }]);
    }
  } finally {
    await db.close();
  }
} else throw new Error("Choose seed or verify");
