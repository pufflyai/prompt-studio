import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { seedDocumentHistory } from "../services/extension-storage/document-history.fixture";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { createProjectionStatistics } from "../services/extension-storage/projection-statistics";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import { createDb } from "./connection.pglite";
import { createResourceRecords } from "./legacy-records/resource-records";
import { createUnadmittedLegacyFixture } from "./legacy-records/unadmitted.fixture";

test("unpreserved core data blocks dependent identity reads while unrelated healthy records remain usable", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-core-admission-"));
  const path = join(root, "database");
  const owner = { workbenchId: "project", extensionId: "example.things" };
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  let statistics: ReturnType<typeof createProjectionStatistics> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    await connection.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('project','P','P','2026-11-22','2026-11-22');
      INSERT INTO storage_record_sync(workbench_id,extension_id,joined) VALUES('project','pstdio',true)`);
    let documents = createDocumentStorageDBService(connection.db);
    let records = documents.open({ owner }).records;
    await records.defineIndexes([
      {
        name: "things",
        fields: {
          id: { path: ["id"], type: "string" },
          shorthand: { path: ["shorthand"], type: "string" },
          state: { path: ["state"], type: "string", derive: { kind: "string" } },
        },
        identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
        countBy: ["state"],
      },
      { name: "plain", fields: { state: { path: ["state"], type: "string" } } },
    ]);
    await records.commit({
      operationId: "tool-save",
      edits: [{ recordId: "card", replace: { id: "claim", state: "open" } }],
    });
    statistics = createProjectionStatistics(connection.db);
    await createResourceRecords(
      connection.db,
      { ...owner, extensionId: "pstdio" },
      {
        statistics,
        changed: () => {},
      },
    ).commit({
      operationId: "legacy-number",
      edits: [
        {
          recordId: "claim",
          replace: {
            id: "claim",
            extensionId: owner.extensionId,
            kind: "thing",
            prefix: "T",
            value: 2,
            aliases: ["T-1"],
          },
        },
      ],
    });
    expect((await records.query({ index: "things" })).records[0]!.fields.shorthand).toBe("T-2");
    expect((await records.aggregate({ index: "things", groupBy: "state" })).count).toBe(1);
    await connection.pglite.exec(`INSERT INTO storage_ordered_owners(workbench_id,extension_id)
      VALUES('project','pstdio')`);
    await seedDocumentHistory(connection.db, {
      owner_id: await ensureStorageOwner(connection.db, { workbenchId: "project", extensionId: "pstdio" }),
      document_id: '["ordered-conversion"]',
      state: new Uint8Array([255]),
    });
    await Bun.write(join(root, "backups"), "Cannot create a backup directory here");
    await statistics.flush();
    statistics = undefined;
    await connection.close();
    connection = undefined;
    const failures: unknown[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(1);
    documents = createDocumentStorageDBService(connection.db);
    records = documents.open({ owner }).records;
    await expect(documents.open({ owner: { ...owner, extensionId: "pstdio" } }).records.read("claim")).rejects.toThrow(
      "unavailable",
    );
    expect((await records.query({ index: "plain" })).records).toHaveLength(1);
    await expect(records.query({ index: "things" })).rejects.toThrow("unavailable");
    await expect(records.query({ index: "things", limit: 0 })).rejects.toThrow("unavailable");
    await expect(records.aggregate({ index: "things", groupBy: "state" })).rejects.toThrow("unavailable");
    const numbers = createExtensionResourceSequencesDBService(connection.db);
    const address = { projectId: "project", extensionId: owner.extensionId, kind: "thing" };
    await expect(numbers.findByShorthand({ ...address, shorthand: "T-1" })).rejects.toThrow("unavailable");
    await expect(numbers.identity({ ...address, id: "claim" })).rejects.toThrow("unavailable");
    expect(await documents.cloudReturn.removalState("project")).toBe("unknown");
    await connection.close();
    connection = undefined;
    await rm(join(root, "backups"));
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(2);
    expect((await connection.pglite.query("SELECT to_regclass('storage_record_sync') AS old")).rows).toEqual([
      { old: null },
    ]);
    records = createDocumentStorageDBService(connection.db).open({ owner }).records;
    expect((await records.query({ index: "plain" })).records).toHaveLength(1);
    // The healthy body remains, while its exported core identity is now absent.
    expect((await records.aggregate({ index: "things", groupBy: "state" })).count).toBe(0);
    expect(
      await createExtensionResourceSequencesDBService(connection.db).findByShorthand({ ...address, shorthand: "T-1" }),
    ).toEqual([]);
  } finally {
    await statistics?.flush();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});
