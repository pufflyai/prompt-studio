import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StorageGroup } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import {
  projects,
  storage_current_records,
  storage_document_operations,
  storage_record_projections,
} from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";

test("terminating a backfill before commit preserves source data and retry identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "projection-upgrade-crash-"));
  const path = join(root, "database");
  const owner = { workbenchId: "upgrade-workbench", extensionId: "example.notes" };
  let database = await createDb({ path });
  let child: ReturnType<typeof Bun.spawn> | undefined;
  let errors: Promise<string> | undefined;
  try {
    const timestamp = new Date().toISOString();
    await database.db.insert(projects).values({
      id: owner.workbenchId,
      name: "Upgrade recovery",
      shorthand: "UR",
      created_at: timestamp,
      updated_at: timestamp,
    });
    const storage = createDocumentStorageDBService(database.db).open({ owner });
    const commit: StorageGroup = {
      operationId: "offline-save",
      edits: [
        {
          recordId: "note",
          replace: { title: "Saved offline", nested: { body: "first\nlast", tags: ["one", "two"] } },
        },
        { recordId: "removed", replace: { title: "Removed" } },
      ],
    };
    await storage.records.commit(commit);
    await storage.records.commit({ operationId: "delete", edits: [{ recordId: "removed", deleted: true }] });
    const before = await storage.records.readMany(["note", "removed"]);
    const identities = await database.db.select().from(storage_document_operations);
    const source = await storage.exportUpdate();
    await database.db.delete(storage_record_projections);
    await database.db.delete(storage_current_records);
    await database.close();
    const worker = Bun.spawn([process.execPath, join(import.meta.dir, "projection-backfill-crash.fixture.ts"), path], {
      stdout: "pipe",
      stderr: "pipe",
    });
    child = worker;
    errors = new Response(worker.stderr).text();
    const reader = worker.stdout.getReader();
    let output = "";
    const decoder = new TextDecoder();
    while (!output.includes("\n")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error(`Backfill exited before its transaction boundary: ${await errors}`);
      output += decoder.decode(chunk.value, { stream: true });
    }
    reader.releaseLock();
    expect(JSON.parse(output.trim())).toMatchObject({ phase: "records-projected", records: 2 });
    worker.kill("SIGKILL");
    await worker.exited;
    database = await createDb({ path });
    expect(await database.db.select().from(storage_record_projections)).toHaveLength(0);
    expect(await database.db.select().from(storage_current_records)).toHaveLength(0);
    expect(await database.db.select().from(storage_document_operations)).toEqual(identities);
    const recovered = createDocumentStorageDBService(database.db).open({ owner });
    expect(await recovered.exportUpdate()).toEqual(source);
    await recovered.records.defineIndexes([]);
    expect(await recovered.records.readMany(["note", "removed"])).toEqual(before);
    await recovered.records.commit(commit);
    expect(await recovered.records.readMany(["note", "removed"])).toEqual(before);
    expect(await database.db.select().from(storage_document_operations)).toEqual(identities);
  } finally {
    if (child?.exitCode === null) child.kill("SIGKILL");
    await child?.exited;
    await errors;
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});
