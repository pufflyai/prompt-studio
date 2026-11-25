import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
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

test("retry history upgrades across batches without retaining obsolete operation maps", async () => {
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
        FROM generate_series(1,401) n;`);
    await prepareOrderedOwnerUpgrade(previous.db, previous.path);
    await prepareOwnerIndexUpgrade(previous.db, previous.path);
    await prepareOwnerProjectionUpgrade(previous.db, previous.path);
    const finish = await prepareDocumentOwnerUpgrade(previous.db, previous.path);
    await migrate(previous.db, { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
    await finish!();

    // Inspect before startup's final collection can hide upgrade amplification.
    const files = documentFilesFor(previous.db);
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
