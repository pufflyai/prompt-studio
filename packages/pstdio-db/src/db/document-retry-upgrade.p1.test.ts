import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { documentFilesFor } from "../services/extension-storage/document-files";
import { createDb } from "./connection.pglite";
import { prepareDocumentOwnerUpgrade } from "./document-owner-upgrade";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { prepareOrderedOwnerUpgrade } from "./ordered-owner-upgrade";
import { prepareOwnerIndexUpgrade } from "./owner-index-upgrade";
import { prepareOwnerProjectionUpgrade } from "./owner-projection-upgrade";
import { releasedDocumentRows } from "./released-document-rows.fixture";

test("retry history coalesces small saves, bounds large batches and keeps only the committed map", async () => {
  const root = await mkdtemp(join(tmpdir(), "document-retry-upgrade-"));
  const previous = await createTextLogOwnerFixture(root);
  let previousClosed = false;
  let reopened: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await previous.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('project','Project','P','2026-11-24','2026-11-24');
      INSERT INTO storage_documents (workbench_id,extension_id,document_id,state)
        VALUES ('project','example.documents','document',decode('0000','hex'));
      INSERT INTO storage_document_operations
        SELECT 'project','example.documents','document','operation-' || n,'fingerprint-' || n
        FROM generate_series(1,401) n;
      INSERT INTO storage_document_operations VALUES ('project','example.documents','document','z-large',repeat('x',4194304));`);
    await prepareOrderedOwnerUpgrade(previous.db, previous.path);
    await prepareOwnerIndexUpgrade(previous.db, previous.path);
    await prepareOwnerProjectionUpgrade(previous.db, previous.path);
    const finish = await prepareDocumentOwnerUpgrade(previous.db, previous.path);
    await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
    const files = documentFilesFor(previous.db);
    const writes = spyOn(files, "put");
    try {
      await finish!();
      expect(writes.mock.calls.filter(([, , kind]) => kind === "operations")).toHaveLength(2);
    } finally {
      writes.mockRestore();
    }

    // Inspect before startup's final collection can hide upgrade amplification.
    const ids = [];
    for await (const id of files.documents("project")) ids.push(id);
    expect(ids).toHaveLength(1);
    const names = [];
    for await (const name of files.names("project", ids[0]!)) names.push(name);
    expect(names.filter((name) => name.startsWith("operations-"))).toHaveLength(1);
    expect(names.filter((name) => name.startsWith("head-"))).toHaveLength(1);
    const expected = Array.from({ length: 401 }, (_, index) => ({
      workbench_id: "project",
      extension_id: "example.documents",
      document_id: "document",
      operation_id: `operation-${index + 1}`,
      fingerprint: `fingerprint-${index + 1}`,
    }));
    expected.push({
      workbench_id: "project",
      extension_id: "example.documents",
      document_id: "document",
      operation_id: "z-large",
      fingerprint: "x".repeat(4 * 1024 * 1024),
    });
    const restored = (await releasedDocumentRows(previous)).storage_document_operations!;
    expect(restored).toHaveLength(expected.length);
    expect(restored).toEqual(expect.arrayContaining(expected));
    await previous.close();
    previousClosed = true;
    reopened = await createDb({ path: previous.path });
    expect((await releasedDocumentRows(reopened)).storage_document_operations).toEqual(restored);
  } finally {
    if (!previousClosed) await previous.close();
    await reopened?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("resource documents stay archived and only owners needing conversion restore their files", async () => {
  const root = await mkdtemp(join(tmpdir(), "released-resource-files-"));
  const old = await createTextLogOwnerFixture(root);
  try {
    await old.pglite.exec(`INSERT INTO projects (id,name,shorthand,created_at,updated_at)
      VALUES ('project','Project','P','2026-11-25','2026-11-25');
      INSERT INTO storage_ordered_owners (workbench_id,extension_id) VALUES
        ('project','converted'),('project','converting'),('project','pstdio');
      INSERT INTO storage_documents (workbench_id,extension_id,document_id,state)
      SELECT 'project',ext,'["resource","card"]',decode('0000','hex') FROM
        unnest(ARRAY['converted','converting','new','pstdio']) ext;
      INSERT INTO storage_document_operations
        SELECT workbench_id,extension_id,document_id,'save','fingerprint' FROM storage_documents;
      INSERT INTO storage_document_updates
        SELECT workbench_id,extension_id,document_id,1,decode('0000','hex') FROM storage_documents;
      INSERT INTO storage_documents (workbench_id,extension_id,document_id,state) VALUES
        ('project','converting','["ordered-conversion"]',decode('0000','hex')),
        ('project','pstdio','resource-identities',decode('0000','hex')),
        ('project','converted','my-document',decode('0000','hex'))`);
    const finish = await prepareDocumentOwnerUpgrade(old.db, old.path);
    await migrate(old.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle-0.46") });
    const archiveFolder = `${old.path}-migration-exports`;
    const blockedArchive = join(archiveFolder, "storage_document_updates.jsonl");
    await mkdir(blockedArchive, { recursive: true });
    await expect(finish!()).rejects.toMatchObject({ syscall: "rename", dest: blockedArchive });
    const { rows } = await old.pglite.query<{
      extension_id: string;
    }>(`SELECT o.extension_id FROM documents d JOIN owners o ON d.owner_id=o.id
      WHERE d.key='["resource","card"]' ORDER BY o.extension_id`);
    expect(rows.map((row) => row.extension_id)).toEqual(["converting", "new", "pstdio"]);
    expect((await old.pglite.query("SELECT key FROM documents WHERE key='my-document'")).rows).toHaveLength(1);
    await rm(blockedArchive, { recursive: true });
    const resume = await prepareDocumentOwnerUpgrade(old.db, old.path);
    await resume!();
    for (const table of ["storage_documents", "storage_document_updates", "storage_document_operations"]) {
      const archive = await Bun.file(join(archiveFolder, `${table}.jsonl`)).text();
      expect(
        archive
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line)),
      ).toContainEqual(
        expect.objectContaining({
          extension_id: "converted",
          document_id: '["resource","card"]',
        }),
      );
    }
  } finally {
    await old.close();
    await rm(root, { recursive: true, force: true });
  }
});
