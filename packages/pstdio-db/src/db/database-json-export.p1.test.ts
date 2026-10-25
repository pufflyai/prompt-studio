import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "pglite-previous";
import { createDocumentStorage, createMemoryDocumentStore } from "pstdio-sync";
import { exportDatabaseAsJson } from "./database-json-export";

const lines = async (path: string) =>
  (await Bun.file(path).text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

test("an old database exports its tables and decoded extension records as JSON lines", async () => {
  const directory = await mkdtemp(join(tmpdir(), "database-json-export-"));
  const db = await PGlite.create();
  const owner = { workbenchId: "project-1", extensionId: "pstdio.pstdio-planner" };
  const old = createDocumentStorage({ owner, store: createMemoryDocumentStore() });
  await old.records.commit({
    operationId: "seed",
    edits: [
      { recordId: "ticket-1", replace: { title: "Keep me", files: [{ name: "plan.md", content: "# Plan" }] } },
      { recordId: "draft", shared: [{ kind: "text.insert", index: 0, text: "Shared text" }] },
      { recordId: "gone", replace: "removed" },
    ],
  });
  await old.records.commit({ operationId: "delete", edits: [{ recordId: "gone", deleted: true }] });
  const later = createDocumentStorage({ owner, store: createMemoryDocumentStore() });
  await later.records.commit({ operationId: "late", edits: [{ recordId: "late", replace: { title: "Late" } }] });
  try {
    await db.exec(`
      create table projects(id text primary key, name text not null, logo bytea, source text);
      create table storage_documents(workbench_id text, extension_id text, document_id text, state bytea not null, revision bigint not null);
      create table storage_document_updates(workbench_id text, extension_id text, document_id text, revision bigint, "update" bytea not null);
    `);
    await db.query("insert into projects values ('project-1', 'Prompt Studio', $1, 'cli')", [new Uint8Array([1, 2])]);
    await db.query("insert into storage_documents values ($1, $2, 'records', $3, 1)", [
      owner.workbenchId,
      owner.extensionId,
      await old.exportUpdate(),
    ]);
    // Updates appended after the stored state still belong to the document.
    await db.query("insert into storage_document_updates values ($1, $2, 'records', 2, $3)", [
      owner.workbenchId,
      owner.extensionId,
      await later.exportUpdate(),
    ]);

    await exportDatabaseAsJson(db, directory);

    expect(await lines(join(directory, "tables", "public.projects.jsonl"))).toEqual([
      { id: "project-1", name: "Prompt Studio", logo: "\\x0102", source: "cli" },
    ]);
    const records = await lines(join(directory, "extension-records", "project-1", "pstdio.pstdio-planner.jsonl"));
    expect(records.map(({ recordId, deleted, value, shared }) => ({ recordId, deleted, value, shared }))).toEqual([
      { recordId: "draft", deleted: false, value: null, shared: { kind: "text", value: "Shared text" } },
      { recordId: "gone", deleted: true, value: null, shared: null },
      { recordId: "late", deleted: false, value: { title: "Late" }, shared: null },
      {
        recordId: "ticket-1",
        deleted: false,
        value: { title: "Keep me", files: [{ name: "plan.md", content: "# Plan" }] },
        shared: null,
      },
    ]);
    expect(await readdir(directory)).toEqual(expect.arrayContaining(["README.md", "tables", "extension-records"]));
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("an unreadable document is listed in errors.txt and every other part still exports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "database-json-export-errors-"));
  const db = await PGlite.create();
  const owner = { workbenchId: "project-1", extensionId: "pstdio.pstdio-planner" };
  const healthy = createDocumentStorage({ owner, store: createMemoryDocumentStore() });
  await healthy.records.commit({ operationId: "seed", edits: [{ recordId: "ticket-1", replace: { title: "Kept" } }] });
  try {
    await db.exec(`
      create table projects(id text primary key);
      create table storage_documents(workbench_id text, extension_id text, document_id text, state bytea not null, revision bigint not null);
      create table storage_document_updates(workbench_id text, extension_id text, document_id text, revision bigint, "update" bytea not null);
      insert into projects values ('project-1');
    `);
    // The damaged document sorts before the healthy one, so a failure cannot hide behind loop order.
    await db.query("insert into storage_documents values ($1, $2, 'a-damaged', $3, 1)", [
      owner.workbenchId,
      owner.extensionId,
      new Uint8Array([255, 255, 255]),
    ]);
    await db.query("insert into storage_documents values ($1, $2, 'records', $3, 1)", [
      owner.workbenchId,
      owner.extensionId,
      await healthy.exportUpdate(),
    ]);

    await exportDatabaseAsJson(db, directory);

    expect(await Bun.file(join(directory, "errors.txt")).text()).toStartWith(
      "extension-records/project-1/pstdio.pstdio-planner.jsonl (document a-damaged): ",
    );
    const records = await lines(join(directory, "extension-records", "project-1", "pstdio.pstdio-planner.jsonl"));
    expect(records.map(({ recordId, value }) => ({ recordId, value }))).toEqual([
      { recordId: "ticket-1", value: { title: "Kept" } },
    ]);
    expect(await lines(join(directory, "tables", "public.projects.jsonl"))).toEqual([{ id: "project-1" }]);
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
