import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { editResourceDocument } from "pstdio-sync/records";
import { encodeRecordFrame } from "pstdio-sync/relay";
import { createExtensionInstancesDBService } from "../services/extension-instances/extension-instances";
import { readDocumentHistory, seedDocumentHistory } from "../services/extension-storage/document-history.fixture";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { createNativeDocumentRoomsDBService } from "../services/extension-storage/native-document-rooms";
import { createNativeFileProjectionsDBService } from "../services/extension-storage/native-file-projections";
import { createProjectionStatistics } from "../services/extension-storage/projection-statistics";
import { createRecoveryPoints } from "../services/extension-storage/recovery-points";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import { createExtensionUserDataDBService } from "../services/extension-user-data/extension-user-data";
import { createInstalledExtensionSourcesDBService } from "../services/installed-extension-sources/installed-extension-sources";
import { createDb } from "./connection.pglite";
import { createResourceRecords } from "./legacy-records/resource-records";
import { createUnadmittedLegacyFixture } from "./legacy-records/unadmitted.fixture";
import { storage_record_outbox, storage_record_sync } from "./legacy-records-schema";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { projects } from "./schemas.pg";

const seed = async (connection: Awaited<ReturnType<typeof createDb>>, corruptId = "example.corrupt") => {
  const now = new Date().toISOString();
  await connection.db.insert(projects).values({
    id: "project",
    name: "Upgrade",
    shorthand: "U",
    created_at: now,
    updated_at: now,
  });
  const statistics = createProjectionStatistics(connection.db);
  try {
    for (const extensionId of ["example.healthy", corruptId]) {
      const owner = { workbenchId: "project", extensionId };
      await connection.db.insert(storage_record_sync).values({
        workbench_id: owner.workbenchId,
        extension_id: extensionId,
        joined: true,
      });
      await createResourceRecords(connection.db, owner, { statistics, changed: () => {} }).commit({
        operationId: "unsent",
        edits: [{ recordId: "card", replace: { title: extensionId } }],
      });
    }
    await connection.db
      .update(storage_record_outbox)
      .set({ frame: new Uint8Array([255]) })
      .where(sql`extension_id=${corruptId}`);
  } finally {
    await statistics.flush();
  }
};

const rows = async (connection: Awaited<ReturnType<typeof createDb>>, table: string) =>
  (
    await connection.pglite.query<{ row: Record<string, unknown> }>(
      `SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`,
    )
  ).rows.map(({ row }) => row);

const files = async (folder: string): Promise<string[]> => {
  const result: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else result.push(path);
  }
  return result;
};

test("opening an upgraded database converts unsent records and durably isolates a corrupt owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-record-upgrade-"));
  const path = join(root, "pstdio.db");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    await seed(connection);
    const original = await rows(connection, "storage_record_outbox");
    await connection.close();
    connection = undefined;
    const diagnostics: { owner: { extensionId: string }; backupPath?: string }[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => diagnostics.push(failure) });
    // Inspect immediately: a records request must not be what performs the conversion.
    expect(
      (
        await connection.pglite.query(`SELECT DISTINCT o.extension_id
      FROM operations r JOIN owners o ON o.id=r.owner_id ORDER BY 1`)
      ).rows,
    ).toEqual([{ extension_id: "example.healthy" }]);
    expect(
      (
        await connection.pglite.query(`SELECT o.extension_id FROM storage_current_records r
      JOIN owners o ON o.id=r.owner_id ORDER BY 1`)
      ).rows,
    ).toEqual([{ extension_id: "example.healthy" }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.owner.extensionId).toBe("example.corrupt");
    expect(diagnostics[0]!.backupPath).toBeDefined();
    const backup = JSON.parse(await readFile(diagnostics[0]!.backupPath!, "utf8"));
    expect(backup.owner).toEqual({ workbenchId: "project", extensionId: "example.corrupt" });
    expect(backup.tables.storage_record_outbox).toEqual(
      original.filter((row) => row.extension_id === "example.corrupt"),
    );
    expect(backup.tables.documents.length).toBeGreaterThan(0);
    const snapshot = await rows(connection, "operations");
    expect(snapshot).toHaveLength(1);
    const savedBackup = await readFile(diagnostics[0]!.backupPath!, "utf8");
    await connection.close();
    connection = undefined;
    connection = await createDb({ path, onLegacyConversionError: (failure) => diagnostics.push(failure) });
    expect(await rows(connection, "operations")).toEqual(snapshot);
    expect(diagnostics).toHaveLength(1);
    expect(await readFile(diagnostics[0]!.backupPath!, "utf8")).toBe(savedBackup);
    expect(
      await Promise.all(
        (await files(join(root, "backups"))).filter((file) => file.endsWith(".json")).map((file) => realpath(file)),
      ),
    ).toEqual([diagnostics[0]!.backupPath!]);
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

for (const failure of ["export", "deletion"])
  test(`a failed recovery ${failure} retains legacy input and still admits healthy owners`, async () => {
    const root = await mkdtemp(join(tmpdir(), "legacy-record-preservation-"));
    const path = join(root, "pstdio.db");
    let connection: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      connection = await createUnadmittedLegacyFixture(path);
      await seed(connection);
      const originals = (await rows(connection, "storage_record_outbox")).filter(
        (row) => row.extension_id === "example.corrupt",
      );
      const corruptOwner = await ensureStorageOwner(connection.db, {
        workbenchId: "project",
        extensionId: "example.corrupt",
      });
      const originalDocuments = (await readDocumentHistory(connection.db)).rows
        .filter((row) => row.owner_id === corruptOwner && row.document_id === '["resource","card"]')
        .map((row) => ({ state: Buffer.from(row.state).toString("hex") }));
      expect(originalDocuments).toHaveLength(1);
      if (failure === "deletion")
        await connection.pglite.exec(`CREATE FUNCTION stop_failed_owner_delete() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF OLD.owner_id=(SELECT id FROM owners WHERE extension_id='example.corrupt')
          THEN RAISE EXCEPTION 'preserve failed owner'; END IF; RETURN OLD; END $$;
          CREATE TRIGGER stop_failed_owner_delete BEFORE DELETE ON documents
          FOR EACH ROW EXECUTE FUNCTION stop_failed_owner_delete()`);
      else await Bun.write(join(root, "backups"), "Cannot create a backup directory here");
      await connection.close();
      connection = undefined;
      const diagnostics: { error: unknown; backupPath?: string }[] = [];
      connection = await createDb({ path, onLegacyConversionError: (event) => diagnostics.push(event) });
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.error).toBeInstanceOf(AggregateError);
      expect(
        (await rows(connection, "storage_record_outbox")).filter((row) => row.extension_id === "example.corrupt"),
      ).toEqual(originals);
      expect(
        (await readDocumentHistory(connection.db)).rows
          .filter((row) => row.owner_id === corruptOwner && row.document_id === '["resource","card"]')
          .map((row) => ({ state: Buffer.from(row.state).toString("hex") })),
      ).toEqual(originalDocuments);
      expect(
        (
          await connection.pglite.query(`SELECT DISTINCT o.extension_id FROM operations p
        JOIN owners o ON o.id=p.owner_id`)
        ).rows,
      ).toEqual([{ extension_id: "example.healthy" }]);
      expect(
        (await connection.pglite.query("SELECT count(*)::int AS count FROM storage_current_records")).rows,
      ).toEqual([{ count: 2 }]);
      if (failure === "deletion") {
        const backup = JSON.parse(await readFile(diagnostics[0]!.backupPath!, "utf8"));
        expect(backup.tables.storage_record_outbox).toEqual(originals);
      } else expect(diagnostics[0]!.backupPath).toBeUndefined();
      const service = createDocumentStorageDBService(connection.db);
      const badOwner = { workbenchId: "project", extensionId: "example.corrupt" };
      const records = service.open({ owner: badOwner }).records;
      await expect(records.read("card")).rejects.toThrow("unavailable");
      await expect(
        records.commit({
          operationId: "new-user-save",
          edits: [{ recordId: "new", replace: { title: "Must not disappear on restart" } }],
        }),
      ).rejects.toThrow("unavailable");
      await expect(service.documents.recordStream(badOwner).pending()).rejects.toThrow("unavailable");
      await expect(service.cloudReturn.status("project")).rejects.toThrow("unavailable");
      expect(await service.cloudReturn.removalState("project")).toBe("unknown");
      await expect(service.openTextDocument({ owner: badOwner, fileId: "note.md" }).save("New text")).rejects.toThrow(
        "unavailable",
      );
      await expect(service.documents.open("records").revision(badOwner)).rejects.toThrow("unavailable");
      await expect(service.openNativeTextDocument({ owner: badOwner, fileId: "note.md" }).snapshot()).rejects.toThrow(
        "unavailable",
      );
      await expect(
        createNativeFileProjectionsDBService(connection.db).initialize({
          owner: badOwner,
          documentKey: "note.md",
          state: new Uint8Array([0, 0]),
        }),
      ).rejects.toThrow("unavailable");
      await expect(
        createNativeDocumentRoomsDBService(connection.db).create({
          owner: badOwner,
          documentKey: "0".repeat(64),
          target: { fileRendererId: "example.corrupt.document", resource: undefined },
          state: new Uint8Array([0, 0]),
        }),
      ).rejects.toThrow("unavailable");
      await expect(createRecoveryPoints(connection.db, service).capture("project")).rejects.toThrow("unavailable");
      const source = await createInstalledExtensionSourcesDBService(connection.db).register({
        install_name: "corrupt",
        extension_id: badOwner.extensionId,
        display_name: "Unavailable",
        source_kind: "local_path",
        source_path: join(root, "extension"),
      });
      const instance = await createExtensionInstancesDBService(connection.db).create({
        installed_extension_id: source.id,
        scope_type: "project",
        scope_id: "project",
      });
      await expect(createExtensionUserDataDBService(connection.db).deleteForInstance(instance.id)).rejects.toThrow(
        "unavailable",
      );
      expect(
        (await service.open({ owner: { ...badOwner, extensionId: "example.healthy" } }).records.read("card")).value,
      ).toEqual({ title: "example.healthy" });
      await service
        .openTextDocument({ owner: { ...badOwner, extensionId: "example.healthy" }, fileId: "note.md" })
        .save("Healthy data stays usable");
      if (failure === "deletion") await connection.pglite.exec("DROP TRIGGER stop_failed_owner_delete ON documents");
      else await rm(join(root, "backups"));
      await connection.close();
      connection = undefined;
      connection = await createDb({ path, onLegacyConversionError: (event) => diagnostics.push(event) });
      expect(diagnostics).toHaveLength(2);
      expect((await connection.pglite.query("SELECT to_regclass('storage_record_outbox') AS old")).rows).toEqual([
        { old: null },
      ]);
      expect(
        (
          await createDocumentStorageDBService(connection.db)
            .open({
              owner: { workbenchId: "project", extensionId: "example.healthy" },
            })
            .records.read("card")
        ).value,
      ).toEqual({ title: "example.healthy" });
      expect(
        await createDocumentStorageDBService(connection.db)
          .openTextDocument({
            owner: { workbenchId: "project", extensionId: "example.healthy" },
            fileId: "note.md",
          })
          .read(),
      ).toBe("Healthy data stays usable");
    } finally {
      await connection?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

test("an unpreserved historical owner retains its original scope and pending bytes across rename retries", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-record-rename-preservation-"));
  const path = join(root, "pstdio.db");
  const extensionId = "pstdio.pstdio-notes";
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    await seed(connection, extensionId);
    const originals = (await rows(connection, "storage_record_outbox")).filter(
      (row) => row.extension_id === extensionId,
    );
    await Bun.write(join(root, "backups"), "Cannot create a backup directory here");
    await connection.close();
    connection = undefined;
    const diagnostics: { backupPath?: string }[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      connection = await createDb({ path, onLegacyConversionError: (event) => diagnostics.push(event) });
      expect(diagnostics).toHaveLength(attempt + 1);
      expect(
        (await rows(connection, "storage_record_outbox")).filter((row) => row.extension_id === extensionId),
      ).toEqual(originals);
      expect(
        (await connection.pglite.query("SELECT extension_id FROM owners WHERE extension_id=$1", [extensionId])).rows,
      ).toEqual([{ extension_id: extensionId }]);
      const service = createDocumentStorageDBService(connection.db);
      for (const name of [extensionId, "pstdio.notes"])
        await expect(
          service.open({ owner: { workbenchId: "project", extensionId: name } }).records.commit({
            operationId: "new-user-save",
            edits: [{ recordId: "new", replace: { title: "Must be refused" } }],
          }),
        ).rejects.toThrow("unavailable");
      await connection.close();
      connection = undefined;
    }
    await rm(join(root, "backups"));
    connection = await createDb({ path, onLegacyConversionError: (event) => diagnostics.push(event) });
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[2]!.backupPath).toBeDefined();
    expect((await connection.pglite.query("SELECT to_regclass('storage_record_outbox') AS old")).rows).toEqual([
      { old: null },
    ]);
    const preserved = JSON.parse(await readFile(diagnostics[2]!.backupPath!, "utf8"));
    expect(preserved.owner).toEqual({ workbenchId: "project", extensionId });
    expect(preserved.tables.storage_record_outbox).toEqual(originals);
    expect(
      (await connection.pglite.query("SELECT extension_id FROM owners WHERE extension_id=$1", [extensionId])).rows,
    ).toEqual([]);
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("released text-owner records convert before the upgraded database opens", async () => {
  const root = await mkdtemp(join(tmpdir(), "released-legacy-record-upgrade-"));
  const previous = await createTextLogOwnerFixture(root);
  let previousClosed = false;
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('project','Upgrade','U','2026-11-22T11:00:00.000Z','2026-11-22T11:00:00.000Z')`);
    for (const extension of ["example.healthy", "example.corrupt"]) {
      const resource = await editResourceDocument([], { recordId: "card", replace: { title: extension } }, true);
      await previous.pglite.query(
        `INSERT INTO storage_documents (workbench_id,extension_id,document_id,state)
        VALUES ('project',$1,'records',decode('0000','hex')),('project',$1,'["resource","card"]',$2)`,
        [extension, resource.checkpoint],
      );
      await previous.pglite.query(
        `INSERT INTO storage_record_projections
        (workbench_id,extension_id,document_id,revision,live_count) VALUES ('project',$1,'records',1,1)`,
        [extension],
      );
      await previous.pglite.query(
        `INSERT INTO storage_current_records
        (workbench_id,extension_id,record_id,deleted,value,revision)
        VALUES ('project',$1,'card',false,$2,$3)`,
        [extension, JSON.stringify(resource.record.value), resource.record.revision],
      );
      await previous.pglite.query(
        `INSERT INTO storage_record_sync (workbench_id,extension_id,joined)
        VALUES ('project',$1,true)`,
        [extension],
      );
      const frame =
        extension === "example.corrupt"
          ? new Uint8Array([255])
          : encodeRecordFrame({ records: [{ recordId: "card", bytes: resource.update! }], assets: [] });
      await previous.pglite.query(
        `INSERT INTO storage_record_outbox (workbench_id,extension_id,frame)
        VALUES ('project',$1,$2)`,
        [extension, frame],
      );
    }
    await previous.close();
    previousClosed = true;
    const diagnostics: { owner: { extensionId: string }; backupPath?: string }[] = [];
    connection = await createDb({ path: previous.path, onLegacyConversionError: (event) => diagnostics.push(event) });
    expect(
      (
        await connection.pglite.query(`SELECT o.extension_id FROM operations p
      JOIN owners o ON o.id=p.owner_id`)
      ).rows,
    ).toEqual([{ extension_id: "example.healthy" }]);
    expect(
      (
        await connection.pglite.query(`SELECT o.extension_id,r.value FROM storage_current_records r
      JOIN owners o ON o.id=r.owner_id`)
      ).rows,
    ).toEqual([{ extension_id: "example.healthy", value: { title: "example.healthy" } }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.owner.extensionId).toBe("example.corrupt");
    const backup = JSON.parse(await readFile(diagnostics[0]!.backupPath!, "utf8"));
    expect(backup.tables.storage_record_outbox[0].frame).toBe("\\xff");
    expect(backup.tables.documents.some((row: { key: string }) => row.key === '["resource","card"]')).toBe(true);
  } finally {
    if (!previousClosed) await previous.close();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a released stream without a records root is preserved and diagnosed during admission", async () => {
  const root = await mkdtemp(join(tmpdir(), "orphan-legacy-stream-"));
  const path = join(root, "pstdio.db");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    const now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id: "project", name: "Stream", shorthand: "S", created_at: now, updated_at: now });
    await connection.db
      .insert(storage_record_sync)
      .values({ workbench_id: "project", extension_id: "example.orphan", joined: true });
    await connection.db
      .insert(storage_record_outbox)
      .values({ workbench_id: "project", extension_id: "example.orphan", frame: new Uint8Array([255]) });
    await connection.close();
    connection = undefined;
    const failures: { owner: { extensionId: string }; backupPath?: string }[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures.map((failure) => failure.owner.extensionId)).toEqual(["example.orphan"]);
    const backup = JSON.parse(await readFile(failures[0]!.backupPath!, "utf8"));
    expect(backup.tables.storage_record_outbox).toHaveLength(1);
    expect(backup.tables.storage_record_outbox[0].frame).toBe("\\xff");
    expect((await connection.pglite.query("SELECT to_regclass('storage_record_outbox') AS old")).rows).toEqual([
      { old: null },
    ]);
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed core owner admits healthy identity queries against its empty number projection", async () => {
  const root = await mkdtemp(join(tmpdir(), "failed-core-identities-"));
  const path = join(root, "pstdio.db");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    const now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id: "project", name: "Identity", shorthand: "I", created_at: now, updated_at: now });
    const owner = { workbenchId: "project", extensionId: "example.things" };
    await createDocumentStorageDBService(connection.db)
      .open({ owner })
      .records.defineIndexes([
        {
          name: "things",
          fields: { id: { path: ["id"], type: "string" }, shorthand: { path: ["shorthand"], type: "string" } },
          identity: { kind: "thing", idField: "id", shorthandField: "shorthand" },
        },
      ]);
    await seedDocumentHistory(connection.db, {
      owner_id: await ensureStorageOwner(connection.db, { workbenchId: "project", extensionId: "pstdio" }),
      document_id: "records",
      state: new Uint8Array([0, 0]),
    });
    await connection.pglite.exec(`      INSERT INTO storage_record_sync(workbench_id,extension_id,joined) VALUES ('project','pstdio',true);
      INSERT INTO storage_record_outbox(workbench_id,extension_id,frame) VALUES ('project','pstdio',decode('ff','hex'))`);
    await connection.close();
    connection = undefined;
    const diagnostics: { owner: { extensionId: string }; backupPath?: string }[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => diagnostics.push(failure) });
    expect(diagnostics.map((event) => event.owner.extensionId)).toEqual(["pstdio"]);
    const records = createDocumentStorageDBService(connection.db).open({ owner }).records;
    expect((await records.query({ index: "things", limit: 10 })).records).toEqual([]);
    expect((await records.aggregate({ index: "things" })).count).toBe(0);
    const backup = JSON.parse(await readFile(diagnostics[0]!.backupPath!, "utf8"));
    expect(backup.tables.storage_record_outbox[0].frame).toBe("\\xff");
    await connection.close();
    connection = undefined;
    connection = await createDb({ path, onLegacyConversionError: (failure) => diagnostics.push(failure) });
    expect(
      (await createDocumentStorageDBService(connection.db).open({ owner }).records.query({ index: "things" })).records,
    ).toEqual([]);
    expect(diagnostics).toHaveLength(1);
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});
