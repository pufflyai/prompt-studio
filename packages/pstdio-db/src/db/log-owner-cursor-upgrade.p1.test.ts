import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeLogCursor } from "pstdio-sync/logs";
import { createOrderedLogStore } from "../services/extension-storage/ordered-log-store";
import { createDb } from "./connection.pglite";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";

test("a cursor issued before retention still sees new appends after the ownership upgrade", async () => {
  const root = await mkdtemp(join(tmpdir(), "log-owner-cursor-upgrade-"));
  const previous = await createTextLogOwnerFixture(root);
  let previousClosed = false;
  let store: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('project','Project','P','2026-11-20T12:00:00.000Z','2026-11-20T12:00:00.000Z');
      INSERT INTO storage_log_streams (workbench_id,extension_id,log_name,scope,stream)
      VALUES ('project','example.logs','activity','project','device');
      SELECT setval('storage_log_entries_local_sequence_seq',9000,true);
      INSERT INTO storage_log_entries (workbench_id,extension_id,log_name,scope,stream,entry_id,writer_id,created_at,fingerprint,entry,local)
      VALUES ('project','example.logs','activity','project','device','expired','device',0,'expired','expired',true);
      DELETE FROM storage_log_entries;`);
    const cursor = encodeLogCursor({
      version: 1,
      address: JSON.stringify({
        workbench_id: "project",
        extension_id: "example.logs",
        log_name: "activity",
        scope: "project",
        stream: "device",
      }),
      relay: 0,
      index: 0,
      local: 9001,
    });
    await previous.close();
    previousClosed = true;
    store = await createDb({ path: previous.path });
    const logs = createOrderedLogStore(store.db, {
      owner: { workbenchId: "project", extensionId: "example.logs" },
      name: "activity",
      scope: "project",
      stream: "device",
      writerId: "device",
    });
    await logs.append({ retained: "new append" }, { id: "new" });
    expect((await logs.read({ after: cursor })).entries.map((entry) => entry.value)).toEqual([
      { retained: "new append" },
    ]);
    expect(await logs.pendingThrough()).toBeGreaterThan(9001);
  } finally {
    if (!previousClosed) await previous.close();
    await store?.close();
    await rm(root, { recursive: true, force: true });
  }
});
