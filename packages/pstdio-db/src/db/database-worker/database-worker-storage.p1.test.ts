import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coreOwnerId, resourceNumbers, resourceNumbersDocumentId } from "pstdio-sync/records";
import { createArtifactFileProjectionsDBService } from "../../services/extension-storage/artifact-file-projections";
import { readDocumentHistory, seedDocumentHistory } from "../../services/extension-storage/document-history.fixture";
import { createDocumentStorageDBService } from "../../services/extension-storage/document-storage";
import { createExtensionStorageDBService } from "../../services/extension-storage/extension-storage";
import { populateExtensionStorageFixture } from "../../services/extension-storage/extension-storage.fixture";
import { ensureStorageOwner } from "../../services/extension-storage/storage-owner-key";
import { createFilesDBService } from "../../services/files/files";
import { createProjectsDBService } from "../../services/projects/projects";
import { createResourceIdentityIndex } from "../../services/resource-identity-index";
import { createDb } from "../connection.pglite";
import type { LegacyConversionFailure } from "../legacy-record-upgrade";
import { createDbInWorker } from "./open";

test("file-backed text and recovery points survive an opt-in database worker restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "database-worker-storage-"));
  const path = join(root, "database");
  const firstText = "Saved text 日本語 🦉";
  let database: Awaited<ReturnType<typeof createDbInWorker>> | undefined;
  try {
    database = await createDbInWorker({ path });
    const { projectAId, svc } = await populateExtensionStorageFixture(database);
    const owner = { workbenchId: projectAId, extensionId: "ext.example" };
    const file = { owner, fileId: "notes" };
    const authority = createFilesDBService(database.db).authority;
    expect(authority).toBe(`database:${database.path}`);
    const note = svc.openTextDocument(file);
    await note.save(firstText);
    await svc.recovery.capture(projectAId, new Date("2026-11-22T09:00:00Z"));
    const [point] = await svc.recovery.list(projectAId);
    expect(point).toMatchObject({ capturedAt: "2026-11-22T09:00:00.000Z", extensions: ["ext.example"] });
    await note.save("Edited text");
    await svc.flushStatistics();
    await database.close();

    database = await createDbInWorker({ path });
    const reopened = createExtensionStorageDBService(database.db);
    expect(createFilesDBService(database.db).authority).toBe(authority);
    expect(await reopened.openTextDocument(file).read()).toBe("Edited text");
    await reopened.recovery.restore(projectAId, point!);
    expect(await reopened.openTextDocument(file).read()).toBe(firstText);
    await reopened.flushStatistics();
  } finally {
    await database?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

test("a worker keeps an unpreserved legacy owner unavailable and reports its recovery failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "database-worker-legacy-"));
  const path = join(root, "database");
  let database: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    database = await createDb({ path });
    const projects = createProjectsDBService(database.db);
    const broken = await projects.create({ name: "Broken numbers" });
    const healthy = await projects.create({ name: "Healthy numbers" });
    const owner = { workbenchId: broken.id, extensionId: coreOwnerId };
    const ownerId = await ensureStorageOwner(database.db, owner);
    await seedDocumentHistory(database.db, {
      owner_id: ownerId,
      document_id: resourceNumbersDocumentId,
      state: new Uint8Array([255]),
    });
    const documents = createDocumentStorageDBService(database.db);
    await documents.documents
      .open(resourceNumbersDocumentId)
      .transaction({ ...owner, workbenchId: healthy.id }, async ({ document }) => {
        resourceNumbers(document).set("healthy", {
          id: "healthy",
          extensionId: "example.items",
          kind: "item",
          prefix: "IT",
          value: 4,
        });
      });
    await documents.flushStatistics();
    await writeFile(join(root, "backups"), "Blocked recovery directory");
    await database.close();

    database = await createDbInWorker({ path });
    const address = { projectId: broken.id, extensionId: "example.items", kind: "item" };
    const index = createResourceIdentityIndex(database.db);
    const blocked = await index.identity({ ...address, id: "retained" }).catch((error: unknown) => error);
    expect(blocked).toMatchObject({ message: expect.stringContaining("unavailable"), cause: expect.any(Error) });
    expect((await index.identity({ ...address, projectId: healthy.id, id: "healthy" }))?.shorthand).toBe("IT-4");
    expect(
      (await readDocumentHistory(database.db)).rows
        .filter((row) => row.owner_id === ownerId && row.document_id === resourceNumbersDocumentId)
        .map((row) => Buffer.from(row.state).toString("hex")),
    ).toEqual(["ff"]);
    await database.close();

    const failures: LegacyConversionFailure[] = [];
    database = await createDbInWorker({ path, onLegacyConversionError: (failure) => failures.push(failure) });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ owner, backupPath: undefined });
    const failure = failures[0]!.error;
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).message).toContain("isolation did not complete");
    expect((failure as AggregateError).errors).toEqual([
      expect.any(Error),
      expect.objectContaining({ code: expect.stringMatching(/^(ENOTDIR|EEXIST)$/) }),
    ]);
    await database.close();

    const observerFailure = new Error("Legacy diagnostic observer failed");
    const interrupted = await createDbInWorker({
      path,
      onLegacyConversionError: () => {
        throw observerFailure;
      },
    }).then(
      async (opened) => {
        await opened.close();
        return undefined;
      },
      (error: unknown) => error,
    );
    expect(interrupted).toBe(observerFailure);
    database = await createDbInWorker({ path, onLegacyConversionError: () => {} });
  } finally {
    await database?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

test("a worker still refuses unresolved mirror roots from an existing migration archive", async () => {
  const root = await mkdtemp(join(tmpdir(), "database-worker-mirrors-"));
  const path = join(root, "database");
  let database: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    database = await createDb({ path });
    const project = await createProjectsDBService(database.db).create({ name: "Mirrors" });
    const owner = { workbenchId: project.id, extensionId: "example.files" };
    const original = createArtifactFileProjectionsDBService(database.db);
    expect(await original.open("known", owner).initialize({})).toBe(true);
    await database.close();

    const archiveRoot = `${path}-migration-exports`;
    const archive = join(archiveRoot, "artifact_file_projection_roots.jsonl");
    const archivedRoots = '{"projection_key":"known"}\n{"projection_key":"unresolved"}\n';
    await mkdir(archiveRoot, { recursive: true });
    await writeFile(archive, archivedRoots);
    database = await createDbInWorker({ path });
    const projections = createArtifactFileProjectionsDBService(database.db);
    const refused = await projections
      .open("unresolved", owner)
      .read()
      .catch((error: unknown) => error);
    expect(refused).toMatchObject({ message: expect.stringContaining("owner needs repair") });
    expect(await projections.open("known", owner).read()).toEqual({ initialized: true, state: {} });
    expect(await readFile(archive, "utf8")).toBe(archivedRoots);
  } finally {
    await database?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
