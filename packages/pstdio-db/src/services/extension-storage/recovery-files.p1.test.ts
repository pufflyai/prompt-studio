import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, type DbClient } from "../../db/connection.pglite";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createProjectsDBService } from "../projects/projects";
import { createExtensionStorageDBService } from "./extension-storage";
import { populateExtensionStorageFixture } from "./extension-storage.fixture";
import { recoveryFilesFor } from "./recovery-files";

const registerOwner = async (db: DbClient, projectId: string, extensionId: string) => {
  const source = await createInstalledExtensionSourcesDBService(db).register({
    install_name: extensionId,
    extension_id: extensionId,
    display_name: extensionId,
    source_kind: "local_path",
    source_path: `/builtin/${extensionId}`,
  });
  await createExtensionInstancesDBService(db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: projectId,
  });
};

test("recovery copies live in verified files, survive reopen and restore, and leave with their project", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-files-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  try {
    connection = await createDb({ path });
    const fixture = await populateExtensionStorageFixture(connection);
    storage = fixture.svc;
    const projectId = fixture.projectAId;
    const owner = { workbenchId: projectId, extensionId: "ext.example" };
    const saved = { title: "Original 日本語\0🦉", nested: { exact: true } };
    const records = (await storage.open({ owner })).records;
    await records.commit({ operationId: "original", edits: [{ recordId: "ticket", replace: saved }] });
    await storage.openTextDocument({ owner, fileId: "notes" }).save("Saved text\0🦉");
    await (await storage.open({ owner })).setDataVersion("notes", 1);
    await storage.recovery.capture(projectId, new Date("2026-11-22T10:00:00.000Z"));
    const point = (await storage.recovery.list(projectId)).find((row) => row.hours === 24)!;
    const byteColumns = await connection.pglite.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='recovery_point_owners' AND data_type='bytea'",
    );
    expect(byteColumns.rows).toEqual([]);
    const { rows: references } = await connection.pglite.query<{ hours: number; sha256: string; bytes: number }>(
      "SELECT hours,sha256,bytes FROM recovery_point_owners WHERE project_id=$1 ORDER BY hours",
      [projectId],
    );
    expect(references).toHaveLength(3);
    const folders = await readdir(`${path}-recovery`);
    expect(folders).toHaveLength(1);
    const folder = join(`${path}-recovery`, folders[0]!);
    for (const reference of references) {
      const bytes = await readFile(join(folder, String(reference.hours), `${reference.sha256}.json.gz`));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(reference.sha256);
      expect(bytes.length).toBe(Number(reference.bytes));
    }
    const orphan = join(folder, "24", `${"a".repeat(64)}.json.gz`);
    await writeFile(orphan, "uncommitted recovery write");
    await storage.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    storage = createExtensionStorageDBService(connection.db);
    expect(existsSync(orphan)).toBe(false);
    const reopened = (await storage.open({ owner })).records;
    await reopened.commit({ operationId: "changed", edits: [{ recordId: "ticket", replace: { title: "Changed" } }] });
    await storage.openTextDocument({ owner, fileId: "notes" }).save("Changed text");
    await storage.recovery.restore(projectId, point);
    expect((await reopened.read("ticket")).value).toEqual(saved);
    expect(await storage.openTextDocument({ owner, fileId: "notes" }).read()).toBe("Saved text\0🦉");
    expect(await (await storage.open({ owner })).dataVersion("notes")).toBe(1);
    await storage.flushStatistics();
    await createProjectsDBService(connection.db).hardDelete(projectId);
    expect(existsSync(folder)).toBe(false);
    expect(await createProjectsDBService(connection.db).get(fixture.projectBId)).not.toBeNull();
  } finally {
    await storage?.flushStatistics();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("recovery rotation budgets the stored files when three due points do not fit", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-file-budget-"));
  const connection = await createDb({ path: join(root, "database") });
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  try {
    const fixture = await populateExtensionStorageFixture(connection);
    let free = Number.MAX_SAFE_INTEGER;
    storage = createExtensionStorageDBService(connection.db, undefined, { freeBytes: async () => free });
    const owner = { workbenchId: fixture.projectAId, extensionId: "ext.example" };
    const value = Array.from({ length: 128 }, (_, index) =>
      createHash("sha256").update(String(index)).digest("hex"),
    ).join("");
    await (await storage.open({ owner })).records.commit({
      operationId: "seed",
      edits: [{ recordId: "random-text", replace: value }],
    });
    const start = new Date("2026-11-22T10:00:00.000Z");
    await storage.recovery.capture(owner.workbenchId, start);
    const {
      rows: [reference],
    } = await connection.pglite.query<{ bytes: number }>(
      "SELECT bytes FROM recovery_point_owners WHERE project_id=$1 AND hours=12",
      [owner.workbenchId],
    );
    free = Number(reference!.bytes) * 3 - 1;
    await storage.recovery.capture(owner.workbenchId, new Date(start.getTime() + 24 * 3_600_000));
    expect((await storage.recovery.list(owner.workbenchId)).map((point) => point.hours)).toEqual([12]);
  } finally {
    await storage?.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("identical owner copies share the file budget without discarding due recovery points", async () => {
  const connection = await createDb({ path: ":memory:" });
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  try {
    const fixture = await populateExtensionStorageFixture(connection);
    let free = Number.MAX_SAFE_INTEGER;
    storage = createExtensionStorageDBService(connection.db, undefined, { freeBytes: async () => free });
    await registerOwner(connection.db, fixture.projectAId, "ext.second");
    for (const extensionId of ["ext.example", "ext.second"]) {
      const records = (await storage.open({ owner: { workbenchId: fixture.projectAId, extensionId } })).records;
      await records.commit({
        operationId: "same-data",
        edits: [{ recordId: "ticket", replace: { title: "Same saved data" } }],
      });
    }
    const start = new Date("2026-11-22T10:00:00.000Z");
    await storage.recovery.capture(fixture.projectAId, start);
    const { rows } = await connection.pglite.query<{ sha256: string; bytes: number }>(
      "SELECT DISTINCT sha256,bytes FROM recovery_point_owners WHERE project_id=$1",
      [fixture.projectAId],
    );
    expect(rows).toHaveLength(1);
    free = Number(rows[0]!.bytes) * 3;
    await storage.recovery.capture(fixture.projectAId, new Date(start.getTime() + 24 * 3_600_000));
    expect((await storage.recovery.list(fixture.projectAId)).map((point) => point.hours)).toEqual([1, 12, 24]);
  } finally {
    await storage?.flushStatistics();
    await connection.close();
  }
});

test("a failed recovery transaction preserves committed copies and collects its orphan on reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-file-rollback-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  try {
    connection = await createDb({ path });
    const fixture = await populateExtensionStorageFixture(connection);
    storage = fixture.svc;
    const owner = { workbenchId: fixture.projectAId, extensionId: "ext.example" };
    const records = (await storage.open({ owner })).records;
    await records.commit({ operationId: "original", edits: [{ recordId: "ticket", replace: "Original" }] });
    const start = new Date("2026-11-22T10:00:00.000Z");
    await storage.recovery.capture(owner.workbenchId, start);
    const point = (await storage.recovery.list(owner.workbenchId)).find((row) => row.hours === 24)!;
    const references = async () =>
      (await connection!.pglite.query("SELECT * FROM recovery_point_owners ORDER BY project_id,hours,owner_id")).rows;
    const before = await references();
    const folder = join(`${path}-recovery`, (await readdir(`${path}-recovery`))[0]!, "1");
    const originalFiles = await readdir(folder);
    const originalBytes = await readFile(join(folder, originalFiles[0]!));
    await records.commit({ operationId: "changed", edits: [{ recordId: "ticket", replace: "Changed" }] });
    await connection.pglite.exec(`CREATE FUNCTION stop_recovery_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'stop recovery write'; END $$;
      CREATE TRIGGER stop_recovery_write BEFORE INSERT ON recovery_point_owners
      FOR EACH ROW EXECUTE FUNCTION stop_recovery_write()`);
    await expect(
      storage.recovery.capture(owner.workbenchId, new Date(start.getTime() + 24 * 3_600_000)),
    ).rejects.toThrow("Failed query");
    expect(await references()).toEqual(before);
    expect(await readFile(join(folder, originalFiles[0]!))).toEqual(originalBytes);
    expect(await readdir(folder)).toHaveLength(2);
    expect((await records.read("ticket")).value).toBe("Changed");
    await connection.pglite.exec("DROP TRIGGER stop_recovery_write ON recovery_point_owners");
    await storage.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    storage = createExtensionStorageDBService(connection.db);
    expect(await readdir(folder)).toEqual(originalFiles);
    expect(await references()).toEqual(before);
    await storage.recovery.restore(owner.workbenchId, point);
    expect((await (await storage.open({ owner })).records.read("ticket")).value).toBe("Original");
  } finally {
    await storage?.flushStatistics();
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a damaged unselected copy does not block restoring a healthy extension", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-file-damage-"));
  const path = join(root, "database");
  const connection = await createDb({ path });
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  try {
    const fixture = await populateExtensionStorageFixture(connection);
    storage = fixture.svc;
    await registerOwner(connection.db, fixture.projectAId, "ext.second");
    const first = (await storage.open({ owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" } }))
      .records;
    const second = (await storage.open({ owner: { workbenchId: fixture.projectAId, extensionId: "ext.second" } }))
      .records;
    await first.commit({ operationId: "first", edits: [{ recordId: "ticket", replace: "Healthy original" }] });
    await second.commit({ operationId: "second", edits: [{ recordId: "ticket", replace: "Other original" }] });
    await storage.recovery.capture(fixture.projectAId, new Date("2026-11-22T10:00:00.000Z"));
    const point = (await storage.recovery.list(fixture.projectAId)).find((row) => row.hours === 24)!;
    const {
      rows: [reference],
    } = await connection.pglite.query<{ sha256: string }>(
      `SELECT r.sha256 FROM recovery_point_owners r JOIN owners o ON r.owner_id=o.id
      WHERE r.project_id=$1 AND r.hours=24 AND o.extension_id='ext.second'`,
      [fixture.projectAId],
    );
    const folder = join(`${path}-recovery`, (await readdir(`${path}-recovery`))[0]!);
    // All slots of this unchanged owner are unavailable; current live records remain readable.
    for (const hours of [1, 12, 24])
      await writeFile(join(folder, String(hours), `${reference!.sha256}.json.gz`), "damaged");
    await first.commit({ operationId: "change", edits: [{ recordId: "ticket", replace: "Healthy changed" }] });
    const before = (await connection.pglite.query("SELECT * FROM recovery_points ORDER BY project_id,hours")).rows;
    await expect(storage.recovery.restore(fixture.projectAId, { ...point, extensionId: "ext.second" })).rejects.toThrow(
      "Some recovery files are unavailable or damaged",
    );
    expect((await first.read("ticket")).value).toBe("Healthy changed");
    expect((await second.read("ticket")).value).toBe("Other original");
    expect((await connection.pglite.query("SELECT * FROM recovery_points ORDER BY project_id,hours")).rows).toEqual(
      before,
    );
    await storage.recovery.restore(fixture.projectAId, { ...point, extensionId: "ext.example" });
    expect((await first.read("ticket")).value).toBe("Healthy original");
    expect((await second.read("ticket")).value).toBe("Other original");
  } finally {
    await storage?.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("low-disk recovery collects dropped copies and failed writes before retrying the retained point", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-file-quota-"));
  const path = join(root, "database");
  const connection = await createDb({ path });
  let storage: ReturnType<typeof createExtensionStorageDBService> | undefined;
  const diskBytes = async (directory: string): Promise<number> => {
    let total = 0;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = join(directory, entry.name);
      total += entry.isDirectory() ? await diskBytes(child) : (await stat(child)).size;
    }
    return total;
  };
  try {
    const fixture = await populateExtensionStorageFixture(connection);
    storage = fixture.svc;
    const owner = { workbenchId: fixture.projectAId, extensionId: "ext.example" };
    const records = (await storage.open({ owner })).records;
    const value = (seed: string) =>
      Array.from({ length: 128 }, (_, index) => createHash("sha256").update(`${seed}:${index}`).digest("hex")).join("");
    await records.commit({ operationId: "old", edits: [{ recordId: "ticket", replace: value("old") }] });
    const start = new Date("2026-11-22T10:00:00.000Z");
    await storage.recovery.capture(owner.workbenchId, start);
    const originalBytes = await diskBytes(`${path}-recovery`);
    await records.commit({ operationId: "new", edits: [{ recordId: "ticket", replace: value("new") }] });
    const files = recoveryFilesFor(connection.db);
    const put = files.put.bind(files);
    let capacity: number | undefined;
    let failures = 0;
    const observed: number[] = [];
    files.put = async (projectId, hours, file) => {
      const used = await diskBytes(`${path}-recovery`);
      capacity ??= used + file.bytes - 1;
      observed.push(used);
      const folder = join(`${path}-recovery`, `p-${Buffer.from(projectId).toString("hex")}`, String(hours));
      if (!existsSync(join(folder, `${file.sha256}.json.gz`)) && used + file.bytes > capacity) {
        // Model a partial filesystem write as well as the retained old copies.
        await writeFile(join(folder, "failed.tmp"), "partial recovery file");
        failures++;
        throw Object.assign(new Error("filesystem capacity exhausted"), { code: "ENOSPC" });
      }
      return put(projectId, hours, file);
    };
    await storage.recovery.capture(owner.workbenchId, new Date(start.getTime() + 24 * 3_600_000));
    expect(failures).toBe(1);
    expect(observed).toEqual([originalBytes, originalBytes / 3]);
    expect((await storage.recovery.list(owner.workbenchId)).map((point) => point.hours)).toEqual([12]);
    const point = (await storage.recovery.list(owner.workbenchId))[0]!;
    await records.commit({ operationId: "latest", edits: [{ recordId: "ticket", replace: "Latest" }] });
    files.put = put;
    await storage.recovery.restore(owner.workbenchId, point);
    expect((await records.read("ticket")).value).toBe(value("new"));
  } finally {
    await storage?.flushStatistics();
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
