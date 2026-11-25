import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { indexNodeFilesFor } from "../services/extension-storage/index-node-files";
import { createProjectionStatistics } from "../services/extension-storage/projection-statistics";
import { createDb } from "./connection.pglite";
import { createResourceRecords } from "./legacy-records/resource-records";
import { createUnadmittedLegacyFixture } from "./legacy-records/unadmitted.fixture";

test("a failed historical owner does not hide another project's healthy renamed data and index files", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-identity-admission-"));
  const path = join(root, "database");
  const previousId = "pstdio.pstdio-notes";
  const extensionId = "pstdio.notes";
  const failed = { workbenchId: "a", extensionId: previousId };
  const healthy = { workbenchId: "b", extensionId };
  const previousHealthy = { ...healthy, extensionId: previousId };
  const bytes = new Uint8Array([3, 1, 4]);
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  let statistics: ReturnType<typeof createProjectionStatistics> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    await connection.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
      VALUES('a','A','A','2026-11-22','2026-11-22'),('b','B','B','2026-11-22','2026-11-22');
      INSERT INTO storage_record_sync(workbench_id,extension_id,joined)
      VALUES('a','pstdio.pstdio-notes',true),('b','pstdio.pstdio-notes',true)`);
    statistics = createProjectionStatistics(connection.db);
    for (const owner of [failed, previousHealthy])
      await createResourceRecords(connection.db, owner, { statistics, changed: () => {} }).commit({
        operationId: "legacy",
        edits: [{ recordId: "card", replace: { title: owner.workbenchId } }],
      });
    await statistics.flush();
    statistics = undefined;
    const files = indexNodeFilesFor(connection.db);
    for (const owner of [failed, previousHealthy])
      for (const kind of ["receipts", "logs"] as const) await files.write(owner, kind, "node", { bytes, children: [] });
    await connection.pglite.exec("UPDATE storage_record_outbox SET frame=decode('ff','hex') WHERE workbench_id='a'");
    await Bun.write(join(root, "backups"), "Cannot create a backup directory here");
    await connection.close();
    connection = undefined;
    const failures: unknown[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
      expect(failures).toHaveLength(attempt + 1);
      const documents = createDocumentStorageDBService(connection.db);
      const records = documents.open({ owner: healthy }).records;
      expect((await records.read("card")).value).toEqual({ title: "b" });
      await expect(documents.open({ owner: failed }).records.read("card")).rejects.toThrow("unavailable");
      expect(
        (
          await connection.pglite.query(
            "SELECT encode(frame,'hex') AS frame FROM storage_record_outbox WHERE workbench_id='a'",
          )
        ).rows,
      ).toEqual([{ frame: "ff" }]);
      expect(
        (
          await connection.pglite.query(
            "SELECT extension_id FROM owners WHERE project_id='b' AND extension_id IN ($1,$2)",
            [previousId, extensionId],
          )
        ).rows,
      ).toEqual([{ extension_id: extensionId }]);
      const nodes = indexNodeFilesFor(connection.db);
      for (const kind of ["receipts", "logs"] as const) {
        expect((await nodes.read(healthy, kind, "node"))?.bytes).toEqual(bytes);
        expect((await nodes.read(failed, kind, "node"))?.bytes).toEqual(bytes);
        expect(await nodes.list(previousHealthy, kind)).toEqual([]);
        if (!attempt) {
          // Recreate a crash after the row rename committed but before files moved.
          await nodes.write(previousHealthy, kind, "node", { bytes, children: [] });
          await nodes.remove(healthy, kind, ["node"]);
        }
      }
      await records.commit({ operationId: `healthy-${attempt}`, edits: [{ recordId: "new", replace: { attempt } }] });
      await connection.close();
      connection = undefined;
    }
    await rm(join(root, "backups"));
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(3);
    expect((await connection.pglite.query("SELECT to_regclass('storage_record_outbox') AS old")).rows).toEqual([
      { old: null },
    ]);
    expect(
      (await createDocumentStorageDBService(connection.db).open({ owner: healthy }).records.read("new")).value,
    ).toEqual({ attempt: 1 });
    for (const kind of ["receipts", "logs"] as const)
      expect((await indexNodeFilesFor(connection.db).read({ ...failed, extensionId }, kind, "node"))?.bytes).toEqual(
        bytes,
      );
  } finally {
    await statistics?.flush();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});
