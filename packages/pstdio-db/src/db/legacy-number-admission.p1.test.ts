import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import { coreOwnerId, rememberResourceNumber, resourceNumbers, resourceNumbersDocumentId } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { readDocumentHistory, seedDocumentHistory } from "../services/extension-storage/document-history.fixture";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import { createProjectsDBService } from "../services/projects/projects";
import { createDb, type DbClient } from "./connection.pglite";
import { upgradeLegacyRecords } from "./legacy-record-upgrade";
import { createUnadmittedLegacyFixture } from "./legacy-records/unadmitted.fixture";
import { resource_numbers } from "./schemas.pg";

const number = (id: string, value: number) => ({ id, extensionId: "example.items", kind: "item", prefix: "IT", value });

test("a direct upgrade keeps a numbered resource and its allocation counter through an extension rename", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-owner-"));
  const path = join(root, "database");
  const { from, to } = extensionIdentityRenames[0]!;
  const previous = `${from.publisher}.${from.name}`;
  const extensionId = `${to.publisher}.${to.name}`;
  const old = await createUnadmittedLegacyFixture(path);
  try {
    let projectId: string;
    try {
      const project = await createProjectsDBService(old.db).create({ name: "Numbered project" });
      projectId = project.id;
      await ensureStorageOwner(old.db, { workbenchId: projectId, extensionId: previous });
      await old.pglite.query(
        "INSERT INTO resource_prefixes(project_id,extension_id,kind,prefix,next_value) VALUES($1,$2,'item','IT',12)",
        [projectId, previous],
      );
      const documents = createDocumentStorageDBService(old.db);
      await documents.documents
        .open(resourceNumbersDocumentId)
        .transaction({ workbenchId: projectId, extensionId: coreOwnerId }, async ({ document }) => {
          const resource = { ...number("saved", 7), extensionId: previous };
          resourceNumbers(document).set(resource.id, resource);
        });
      await documents.flushStatistics();
    } finally {
      await old.close();
    }
    const current = await createDb({ path });
    try {
      const service = createExtensionResourceSequencesDBService(current.db);
      const input = { projectId, extensionId, kind: "item", prefix: "IT" };
      try {
        expect((await service.identity({ ...input, id: "saved" }))?.shorthand).toBe("IT-7");
        expect((await service.allocate(input)).shorthand).toBe("IT-12");
      } finally {
        await service.flush();
      }
    } finally {
      await current.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("opening admits legacy numbers before services and retains newer records without reviving deleted ones", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-admission-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    const project = await createProjectsDBService(connection.db).create({ name: "Old numbers" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const documents = createDocumentStorageDBService(connection.db);
    await documents.open({ owner }).records.commit({
      operationId: "new-format",
      edits: [
        { recordId: "newer", replace: { ...number("newer", 20), aliases: ["IT-2"] } },
        { recordId: "deleted", replace: { ...number("deleted", 30), aliases: [] } },
        { recordId: "opaque", replace: { arbitrary: "core JSON" } },
      ],
    });
    await documents.open({ owner }).records.commit({
      operationId: "delete",
      edits: [{ recordId: "deleted", deleted: true }],
    });
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
      for (const resource of [number("old", 7), number("newer", 2), number("deleted", 3), number("opaque", 4)]) {
        resourceNumbers(document).set(resource.id, resource);
        rememberResourceNumber(document, resource);
      }
      rememberResourceNumber(document, number("old", 50));
    });
    await connection.db.insert(resource_numbers).values({
      project_id: project.id,
      resource_id: "ghost",
      extension_id: "example.items",
      kind: "item",
      shorthand: "IT-99",
      prefix: "IT",
      value: 99,
      current: true,
      alias: true,
    });
    await connection.pglite.query("INSERT INTO storage_ordered_owners(workbench_id,extension_id) VALUES($1,$2)", [
      project.id,
      coreOwnerId,
    ]);
    await documents.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    // Startup owns conversion: this assertion precedes construction of any number service.
    expect((await connection.pglite.query("SELECT key FROM documents WHERE key='resource-identities'")).rows).toEqual(
      [],
    );
    expect(
      (await connection.pglite.query("SELECT value->>'value' AS value FROM records WHERE record_id='old'")).rows,
    ).toEqual([{ value: "7" }]);
    const service = createExtensionResourceSequencesDBService(connection.db);
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    expect(await service.identity({ ...input, id: "old" })).toEqual({
      id: "old",
      kind: "item",
      shorthand: "IT-7",
      aliases: ["IT-50"],
    });
    expect((await service.identity({ ...input, id: "newer" }))?.shorthand).toBe("IT-20");
    expect(await service.identity({ ...input, id: "deleted" })).toBeNull();
    expect(await service.identity({ ...input, id: "opaque" })).toBeNull();
    expect(await service.identity({ ...input, id: "ghost" })).toBeNull();
    expect((await createDocumentStorageDBService(connection.db).open({ owner }).records.read("opaque")).value).toEqual({
      arbitrary: "core JSON",
    });
    expect((await service.allocate(input)).shorthand).toBe("IT-51");
    await connection.close();
    connection = await createDb({ path });
    expect(
      (
        await createExtensionResourceSequencesDBService(connection.db).findByShorthand({ ...input, shorthand: "IT-50" })
      ).map((row) => row.id),
    ).toEqual(["old"]);
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a number-only owner is admitted even after the old stream tables have retired", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-only-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const project = await createProjectsDBService(connection.db).create({ name: "Numbers only" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const documents = createDocumentStorageDBService(connection.db);
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
      resourceNumbers(document).set("only", number("only", 9));
      rememberResourceNumber(document, number("only", 19));
    });
    await documents.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    expect(
      (await connection.pglite.query("SELECT value->>'value' AS value FROM records WHERE record_id='only'")).rows,
    ).toEqual([{ value: "9" }]);
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    expect((await createExtensionResourceSequencesDBService(connection.db).allocate(input)).shorthand).toBe("IT-20");
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("interrupted number admission preserves its source and resumes after a committed page", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-resume-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    const project = await createProjectsDBService(connection.db).create({ name: "Interrupted numbers" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const documents = createDocumentStorageDBService(connection.db);
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
      for (let index = 0; index < 201; index++)
        resourceNumbers(document).set(`item-${index}`, number(`item-${index}`, index + 1));
    });
    const original = (await readDocumentHistory(connection.db)).rows.filter(
      (row) => row.document_id === resourceNumbersDocumentId,
    );
    const controller = new AbortController();
    const transaction = connection.db.transaction.bind(connection.db);
    type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
    connection.db.transaction = async <T>(
      run: (tx: Transaction) => Promise<T>,
      config?: Parameters<DbClient["transaction"]>[1],
    ) => {
      const result = await transaction(run, config);
      const count = (await connection!.pglite.query<{ count: number }>("SELECT count(*)::int AS count FROM records"))
        .rows[0]!.count;
      if (count === 100) controller.abort(new Error("Interrupted after committed number page"));
      return result;
    };
    await expect(upgradeLegacyRecords(connection.db, path, { signal: controller.signal })).rejects.toThrow(
      "Interrupted after committed number page",
    );
    connection.db.transaction = transaction;
    expect(
      (await readDocumentHistory(connection.db)).rows.filter((row) => row.document_id === resourceNumbersDocumentId),
    ).toEqual(original);
    expect((await connection.pglite.query("SELECT count(*)::int AS count FROM records")).rows).toEqual([
      { count: 100 },
    ]);
    const operations = (await connection.pglite.query("SELECT operation_id FROM operations ORDER BY operation_id"))
      .rows;
    await documents.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    expect((await connection.pglite.query("SELECT count(*)::int AS count FROM records")).rows).toEqual([
      { count: 201 },
    ]);
    const saved = (await connection.pglite.query("SELECT operation_id FROM operations ORDER BY operation_id")).rows;
    expect(saved).toHaveLength(3);
    expect(saved).toEqual(expect.arrayContaining(operations));
    expect((await connection.pglite.query("SELECT key FROM documents WHERE key='resource-identities'")).rows).toEqual(
      [],
    );
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    expect((await createExtensionResourceSequencesDBService(connection.db).allocate(input)).shorthand).toBe("IT-202");
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("failed number recovery retains and gates its owner while another project opens, then preserves exact input before isolation", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-recovery-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const projects = createProjectsDBService(connection.db);
    const broken = await projects.create({ name: "Broken numbers" });
    const healthy = await projects.create({ name: "Healthy numbers" });
    const owner = { workbenchId: broken.id, extensionId: coreOwnerId };
    const ownerId = await ensureStorageOwner(connection.db, owner);
    await seedDocumentHistory(connection.db, {
      owner_id: ownerId,
      document_id: resourceNumbersDocumentId,
      state: new Uint8Array([255]),
    });
    await connection.pglite.query(
      `INSERT INTO resource_numbers(project_id,resource_id,extension_id,kind,shorthand,prefix,value,canonical)
      VALUES($1,'retained','example.items','item','IT-9223372036854775807','IT',9223372036854775807,true)`,
      [broken.id],
    );
    const documents = createDocumentStorageDBService(connection.db);
    await documents.documents
      .open(resourceNumbersDocumentId)
      .transaction({ ...owner, workbenchId: healthy.id }, async ({ document }) => {
        resourceNumbers(document).set("healthy", number("healthy", 4));
      });
    await documents.flushStatistics();
    await writeFile(join(root, "backups"), "Blocked recovery directory");
    await connection.close();
    const failures: { backupPath?: string }[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(1);
    expect(failures[0]!.backupPath).toBeUndefined();
    expect(
      (await readDocumentHistory(connection.db)).rows
        .filter((row) => row.owner_id === ownerId && row.document_id === resourceNumbersDocumentId)
        .map((row) => ({ state: Buffer.from(row.state).toString("hex") })),
    ).toEqual([{ state: "ff" }]);
    const service = createExtensionResourceSequencesDBService(connection.db);
    const input = { projectId: broken.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    await expect(service.identity({ ...input, id: "retained" })).rejects.toThrow("unavailable");
    expect((await service.identity({ ...input, projectId: healthy.id, id: "healthy" }))?.shorthand).toBe("IT-4");
    await connection.close();
    await rm(join(root, "backups"));
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(2);
    const backup = JSON.parse(await readFile(failures[1]!.backupPath!, "utf8"));
    expect(backup.tables.documents).toEqual(
      expect.arrayContaining([expect.objectContaining({ owner_id: ownerId, key: resourceNumbersDocumentId })]),
    );
    expect(backup.document_files.find((row: { key: string }) => row.key === resourceNumbersDocumentId).files).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "state", data: "\\xff" })]),
    );
    expect(String(backup.tables.resource_numbers[0].value)).toBe("9223372036854775807");
    expect((await connection.pglite.query("SELECT key FROM documents WHERE key='resource-identities'")).rows).toEqual(
      [],
    );
    expect(
      await createExtensionResourceSequencesDBService(connection.db).identity({ ...input, id: "retained" }),
    ).toBeNull();
    expect(
      (await createExtensionResourceSequencesDBService(connection.db).allocate({ ...input, projectId: healthy.id }))
        .shorthand,
    ).toBe("IT-5");
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

for (const mode of ["deleted", "history-only", "deleted-joined", "history-only-joined"])
  test(`legacy ${mode} number history retains its floor without a visible identity`, async () => {
    const root = await mkdtemp(join(tmpdir(), "legacy-number-floor-"));
    const path = join(root, "database");
    let connection: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      connection = await createDb({ path });
      const project = await createProjectsDBService(connection.db).create({ name: "Retired number history" });
      const owner = { workbenchId: project.id, extensionId: coreOwnerId };
      const documents = createDocumentStorageDBService(connection.db);
      if (mode.startsWith("deleted")) {
        await documents.open({ owner }).records.commit({
          operationId: "new-number",
          edits: [{ recordId: "retired", replace: { ...number("retired", 30), aliases: [] } }],
        });
        await documents
          .open({ owner })
          .records.commit({ operationId: "delete-number", edits: [{ recordId: "retired", deleted: true }] });
      }
      await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
        if (mode.startsWith("deleted")) resourceNumbers(document).set("retired", number("retired", 3));
        rememberResourceNumber(document, number("retired", 700));
      });
      const ownerId = await ensureStorageOwner(connection.db, owner);
      const source = (await readDocumentHistory(connection.db)).rows.find(
        (row) => row.owner_id === ownerId && row.document_id === resourceNumbersDocumentId,
      )!.state;
      if (mode.endsWith("joined"))
        await connection.pglite.query("UPDATE owners SET joined=true,epoch='remote-floor-test' WHERE id=$1", [ownerId]);
      await documents.flushStatistics();
      await connection.close();
      connection = await createDb({ path });
      const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
      let service = createExtensionResourceSequencesDBService(connection.db);
      expect(await service.identity({ ...input, id: "retired" })).toBeNull();
      const folder = `${path}-migration-exports`;
      const archiveName = (await readdir(folder)).find(
        (name) => name.startsWith(`legacy-number-${ownerId}-`) && name.endsWith("-documents.jsonl"),
      );
      expect(archiveName).toBeDefined();
      const archive = JSON.parse((await readFile(join(folder, archiveName!), "utf8")).trim());
      expect(archive.files.find((file: { kind: string }) => file.kind === "state").data).toBe(
        `\\x${Buffer.from(source).toString("hex")}`,
      );
      if (mode.endsWith("joined"))
        expect(
          (await connection.pglite.query("SELECT canonical,current,alias FROM resource_numbers WHERE value=700")).rows,
        ).toEqual([{ canonical: false, current: false, alias: true }]);
      expect((await service.allocate(input)).shorthand).toBe("IT-701");
      await connection.close();
      connection = await createDb({ path });
      service = createExtensionResourceSequencesDBService(connection.db);
      expect(await service.identity({ ...input, id: "retired" })).toBeNull();
      expect((await service.allocate(input)).shorthand).toBe("IT-702");
    } finally {
      await connection?.close();
      await rm(root, { recursive: true, force: true });
    }
  });

test("unpreserved terminal number owners keep original resource histories while healthy owners clean theirs", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-terminal-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createUnadmittedLegacyFixture(path);
    const projects = createProjectsDBService(connection.db);
    const broken = await projects.create({ name: "Broken terminal" });
    const healthy = await projects.create({ name: "Healthy terminal" });
    const owner = { workbenchId: broken.id, extensionId: coreOwnerId };
    const healthyOwner = { workbenchId: healthy.id, extensionId: "example.healthy" };
    const ownerId = await ensureStorageOwner(connection.db, owner);
    const healthyId = await ensureStorageOwner(connection.db, healthyOwner);
    const document = new Y.Doc();
    document.getMap("history").set("original", "preserve-日本語\u0000");
    const bytes = Y.encodeStateAsUpdate(document);
    document.destroy();
    for (const [id, projectId, extensionId] of [
      [ownerId, broken.id, coreOwnerId],
      [healthyId, healthy.id, healthyOwner.extensionId],
    ] as const) {
      await seedDocumentHistory(connection.db, { owner_id: id, document_id: '["resource","original"]', state: bytes });
      await connection.pglite.query("INSERT INTO storage_ordered_owners(workbench_id,extension_id) VALUES($1,$2)", [
        projectId,
        extensionId,
      ]);
    }
    await seedDocumentHistory(connection.db, {
      owner_id: ownerId,
      document_id: resourceNumbersDocumentId,
      state: new Uint8Array([255]),
    });
    await writeFile(join(root, "backups"), "Blocked recovery directory");
    await connection.close();
    const failures: unknown[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(1);
    expect(
      (await readDocumentHistory(connection.db)).rows
        .filter((row) => row.owner_id === ownerId && row.document_id === '["resource","original"]')
        .map((row) => ({ state: row.state })),
    ).toEqual([{ state: bytes }]);
    expect((await connection.pglite.query("SELECT key FROM documents WHERE owner_id=$1", [healthyId])).rows).toEqual(
      [],
    );
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy history refuses a colliding authored record and failed recovery leaves its body intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-collision-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const project = await createProjectsDBService(connection.db).create({ name: "History conflict" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const recordId = `legacy-number-history:${await fingerprint(["retired", { IT: 700 }])}`;
    const documents = createDocumentStorageDBService(connection.db);
    await documents
      .open({ owner })
      .records.commit({ operationId: "authored", edits: [{ recordId, replace: { authored: "preserve" } }] });
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
      rememberResourceNumber(document, number("retired", 700));
    });
    await documents.flushStatistics();
    await writeFile(join(root, "backups"), "Blocked recovery directory");
    await connection.close();
    const failures: { error: unknown }[] = [];
    connection = await createDb({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(1);
    expect((failures[0]!.error as AggregateError).errors[0]).toMatchObject({
      message: "Retained legacy number history conflicts with an existing core record",
    });
    expect(
      (await connection.pglite.query("SELECT value,deleted FROM records WHERE record_id=$1", [recordId])).rows,
    ).toEqual([{ value: { authored: "preserve" }, deleted: false }]);
    expect(
      (await connection.pglite.query("SELECT key FROM documents WHERE key='resource-identities'")).rows,
    ).toHaveLength(1);
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("history-only floors preserve a prefix that is also a JavaScript object property", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-prefix-"));
  const path = join(root, "database");
  let connection: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    connection = await createDb({ path });
    const project = await createProjectsDBService(connection.db).create({ name: "Prefix history" });
    const documents = createDocumentStorageDBService(connection.db);
    await documents.documents
      .open(resourceNumbersDocumentId)
      .transaction({ workbenchId: project.id, extensionId: coreOwnerId }, async ({ document }) => {
        rememberResourceNumber(document, { ...number("retired", 700), prefix: "__proto__" });
      });
    await documents.flushStatistics();
    await connection.close();
    connection = await createDb({ path });
    expect(
      (
        await createExtensionResourceSequencesDBService(connection.db).allocate({
          projectId: project.id,
          extensionId: "example.items",
          kind: "item",
          prefix: "__proto__",
        })
      ).shorthand,
    ).toBe("__proto__-701");
  } finally {
    await connection?.close();
    await rm(root, { recursive: true, force: true });
  }
});
