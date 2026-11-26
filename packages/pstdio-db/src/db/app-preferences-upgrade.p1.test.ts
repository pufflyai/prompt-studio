import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEnvironmentDBService } from "../services/environment/environment";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { withOrderedOwner } from "../services/extension-storage/ordered-journal";
import { createOrderedLogStore } from "../services/extension-storage/ordered-log-store";
import { createPersonalHistoryIndex } from "../services/extension-storage/personal-history-index";
import { createSettingsDBService } from "../services/settings/settings";
import { createDb } from "./connection.pglite";
import { restoreReleasedPreferenceTables } from "./preference-upgrade.fixture";

test("upgrading preserves device identity and global settings without replaying old values on reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "app-preferences-upgrade-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const stamp = "2026-11-20T00:00:00.000Z";
    await connection.pglite.query(
      "INSERT INTO projects (id,name,shorthand,created_at,updated_at) VALUES ('saved-project','Saved','SAVE',$1,$1)",
      [stamp],
    );
    const owner = { workbenchId: "saved-project", extensionId: "private-alice" };
    const address = { owner, name: "activity", scope: "project", stream: "laptop", writerId: "laptop" };
    const logs = createOrderedLogStore(connection.db, address);
    const entry = await logs.append({ text: "日本語 😀" }, { id: "pending" });
    const delivery = {
      envelope: { updateId: "retained-retry", payload: "AAEC/w==", blobIds: ["saved-blob"] },
      blobs: [{ blobId: "saved-blob", bytes: "AP8=", children: [] }],
    };
    await logs.prepare(entry.id, delivery);
    const history = createPersonalHistoryIndex(connection.db);
    const delta = { deviceId: "laptop", kind: "sessions", id: "saved", value: { id: "saved", title: "Kept" } };
    await history.apply(owner, "retained-cursor", [delta]);
    await history.markMigrated(owner);
    const recordInput = {
      operationId: "saved-operation",
      edits: [{ recordId: "saved-record", replace: { title: "日本語 😀", bytes: "\u0000" } }],
    };
    await createDocumentStorageDBService(connection.db).open({ owner }).records.commit(recordInput);
    await restoreReleasedPreferenceTables(connection);
    await connection.pglite.query("INSERT INTO settings VALUES ('global', true, true, 3, $1, $1)", [stamp]);
    await connection.pglite.query("INSERT INTO local_environment VALUES ('local', 'retained-device')");
    await connection.close();
    connection = await createDb({ path });
    const assertStorage = async () => {
      const restored = createOrderedLogStore(connection!.db, address);
      expect(await restored.pending(10)).toEqual([{ entry, delivery: undefined }]);
      const restoredHistory = createPersonalHistoryIndex(connection!.db);
      expect(await restoredHistory.read(owner, "sessions")).toEqual([delta.value]);
      expect(await restoredHistory.cursor(owner)).toBeNull();
      expect(await restoredHistory.migrated(owner)).toBe(true);
      const records = createDocumentStorageDBService(connection!.db).open({ owner }).records;
      expect((await records.read("saved-record")).value).toEqual(recordInput.edits[0]!.replace);
      expect(await withOrderedOwner(connection!.db, owner, (journal) => journal.pending())).toEqual([]);
      await records.commit(recordInput);
      expect(await withOrderedOwner(connection!.db, owner, (journal) => journal.pending())).toEqual([]);
    };
    await assertStorage();
    const store = createSettingsDBService(connection.db);
    expect(await store.get()).toMatchObject({
      id: "global",
      created_at: stamp,
      updated_at: stamp,
      notifications_enabled: true,
      machine_tokens_enabled: true,
      max_concurrent_sessions: 3,
    });
    expect(await createEnvironmentDBService(connection.db).get()).toEqual({ environmentId: "retained-device" });
    await store.update({ notifications_enabled: false, max_concurrent_sessions: 5 });
    await connection.close();
    connection = await createDb({ path });
    await assertStorage();
    expect(await createSettingsDBService(connection.db).get()).toMatchObject({
      id: "global",
      created_at: stamp,
      notifications_enabled: false,
      machine_tokens_enabled: true,
      max_concurrent_sessions: 5,
    });
    expect(await createEnvironmentDBService(connection.db).get()).toEqual({ environmentId: "retained-device" });
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
    await rm(`${path}-index-nodes`, { recursive: true, force: true });
  }
}, 15_000);
