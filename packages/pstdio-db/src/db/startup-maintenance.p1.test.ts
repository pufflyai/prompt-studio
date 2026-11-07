import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "./connection.pglite";

const diskLimit = process.platform === "win32" ? 15_000 : undefined;
const owner = (kind: string, account = "alice") => JSON.stringify([kind, "https://manager.example", account]);
const relation = async (client: Awaited<ReturnType<typeof createDb>>, table = "storage_document_updates") =>
  (
    await client.pglite.query<{ bytes: number; node: number }>(
      "SELECT pg_total_relation_size(oid)::int AS bytes, relfilenode::int AS node FROM pg_class WHERE relname = $1",
      [table],
    )
  ).rows[0];

test(
  "startup removes retired conversation documents across projects and reclaims their storage",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-maintenance-"));
    const path = join(root, "database");
    let client = await createDb({ path });
    try {
      const legacy = [owner("pstdio.personal-history"), owner("pstdio.personal-history", "bob")];
      const current = [
        owner("pstdio.personal-history.logs-v1"),
        owner("pstdio.personal-history.logs-v2"),
        owner("pstdio.personal-history-other"),
        "example.notes",
      ];
      for (const project of ["offline", "signed-out"])
        await client.pglite.query(
          "INSERT INTO projects (id,name,shorthand,created_at,updated_at) VALUES ($1,$1,$1,'now','now')",
          [project],
        );
      await client.pglite.exec(
        "INSERT INTO sessions (id,title,project_id,created_at,updated_at) VALUES ('local-session','Keep this conversation','offline','now','now')",
      );
      for (const [index, extension] of [...legacy, ...current].entries()) {
        const project = index === 1 ? "signed-out" : "offline";
        const document = index < 2 ? JSON.stringify(["transcript", String(index)]) : "records";
        await client.pglite.query(
          "INSERT INTO storage_documents (workbench_id,extension_id,document_id,state) VALUES ($1,$2,$3,$4)",
          [project, extension, document, new Uint8Array([0, 0])],
        );
        // Retired transcripts need no directory entry and must never be decoded to remove them.
        await client.pglite.query(
          "INSERT INTO storage_document_updates (workbench_id,extension_id,document_id,revision,update) VALUES ($1,$2,$3,1,$4)",
          [project, extension, document, index < 2 ? randomBytes(512 * 1024) : new Uint8Array([0, 0])],
        );
        await client.pglite.query(
          "INSERT INTO storage_document_operations (workbench_id,extension_id,document_id,operation_id,fingerprint) VALUES ($1,$2,$3,'operation','fingerprint')",
          [project, extension, document],
        );
      }
      const before = await relation(client);
      await client.close();
      const phases: string[] = [];
      client = await createDb({ path, onPhase: (phase) => phases.push(phase) });
      expect(phases.filter((phase) => ["database_cleaning", "database_compacting"].includes(phase))).toEqual([
        "database_cleaning",
        "database_compacting",
      ]);
      expect(phases.indexOf("database_cleaning")).toBeGreaterThan(phases.indexOf("database_opened"));
      expect(phases.indexOf("database_compacting")).toBeLessThan(phases.indexOf("database_migrated"));
      const remaining = await client.pglite.query<{ extension_id: string }>(
        "SELECT extension_id FROM storage_documents ORDER BY extension_id",
      );
      expect(remaining.rows.map((row) => row.extension_id)).toEqual([...current].sort());
      for (const table of ["storage_document_updates", "storage_document_operations"])
        expect((await client.pglite.query(`SELECT extension_id FROM ${table} ORDER BY extension_id`)).rows).toEqual(
          remaining.rows,
        );
      expect((await client.pglite.query("SELECT title FROM sessions")).rows).toEqual([
        { title: "Keep this conversation" },
      ]);
      const after = await relation(client);
      expect(after.bytes).toBeLessThan(before.bytes / 2);
      expect(after.node).not.toBe(before.node);
    } finally {
      await client.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  diskLimit,
);

test(
  "startup vacuums a changed migration and skips unchanged starts",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-migration-maintenance-"));
    const path = join(root, "database");
    let client = await createDb({ path });
    try {
      const fresh = await relation(client);
      // A committed migration remains visible after an interruption, even if it reuses earlier SQL.
      await client.pglite.exec(
        "INSERT INTO drizzle.__drizzle_migrations (hash,created_at) SELECT hash,created_at+1 FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      );
      await client.close();
      client = await createDb({ path });
      const migrated = await relation(client);
      expect(migrated.node).not.toBe(fresh.node);
      await client.close();
      client = await createDb({ path });
      expect((await relation(client)).node).toBe(migrated.node);
    } finally {
      await client.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  diskLimit,
);

test(
  "startup retries unfinished maintenance without repeating completed work",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-maintenance-retry-"));
    const path = join(root, "database");
    let client = await createDb({ path });
    try {
      const before = await relation(client);
      await client.close();
      await rm(join(path, ".pstdio-maintenance.json"));
      client = await createDb({ path });
      const retried = await relation(client);
      expect(retried.node).not.toBe(before.node);
      await client.close();
      client = await createDb({ path });
      expect((await relation(client)).node).toBe(retried.node);
    } finally {
      await client.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  diskLimit,
);
