import { expect, spyOn, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readDocumentHistory, seedDocumentHistory } from "../services/extension-storage/document-history.fixture";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import { createDb } from "./connection.pglite";

const diskLimit = process.platform === "win32" ? 15_000 : undefined;
const owner = (kind: string, account = "alice") => JSON.stringify([kind, "https://manager.example", account]);
const relation = async (client: Awaited<ReturnType<typeof createDb>>, table = "documents") =>
  (
    await client.pglite.query<{ bytes: number; node: number }>(
      "SELECT pg_total_relation_size(oid)::int AS bytes, relfilenode::int AS node FROM pg_class WHERE relname = $1",
      [table],
    )
  ).rows[0];
const documentBytes = async (path: string) => {
  let bytes = 0;
  const folder = `${path}-documents`;
  for await (const file of new Bun.Glob("**/*").scan({ cwd: folder, onlyFiles: true }))
    bytes += Bun.file(join(folder, file)).size;
  return bytes;
};

test(
  "a failed vacuum keeps the database usable and retries maintenance on the next start",
  async () => {
    const started = performance.now();
    const phase = (name: string) =>
      console.log(`[maintenance failure +${Math.round(performance.now() - started)}ms] ${name}`);
    const root = await mkdtemp(join(tmpdir(), "pstdio-maintenance-failure-"));
    const path = join(root, "database");
    const open = async (name: string) => {
      phase(`${name}:start`);
      const client = await createDb({ path, onPhase: (step) => phase(`${name}:${step}`) });
      phase(`${name}:ready`);
      return client;
    };
    let client = await open("initial");
    const originalExec = PGlite.prototype.exec;
    const execute = spyOn(PGlite.prototype, "exec");
    const warning = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const before = await relation(client);
      await client.close();
      phase("initial:closed");
      await rm(join(path, ".pstdio-maintenance.json"));
      execute.mockImplementation(function (this: PGlite, query, options) {
        if (query === "VACUUM (FULL, ANALYZE)")
          throw Object.assign(new Error("could not extend file: No space left on device"), { code: "53100" });
        return originalExec.call(this, query, options);
      });
      client = await open("failed-vacuum");
      expect((await client.pglite.query("SELECT 1 AS ready")).rows).toEqual([{ ready: 1 }]);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(await Bun.file(join(path, ".pstdio-maintenance.json")).exists()).toBe(false);
      expect((await relation(client)).node).toBe(before.node);
      await client.close();
      phase("failed-vacuum:closed");
      execute.mockRestore();
      client = await open("recovery");
      expect((await relation(client)).node).not.toBe(before.node);
      await access(join(path, ".pstdio-maintenance.json"));
    } finally {
      execute.mockRestore();
      warning.mockRestore();
      await client.close();
      phase("cleanup:closed");
      await rm(root, { recursive: true, force: true });
      phase("removed");
    }
  },
  process.platform === "linux" ? 10_000 : diskLimit,
);

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
        const ownerId = await ensureStorageOwner(client.db, { workbenchId: project, extensionId: extension });
        await seedDocumentHistory(client.db, {
          owner_id: ownerId,
          document_id: document,
          state: new Uint8Array([0, 0]),
          revision: 1,
          updates: [{ revision: 1, update: index < 2 ? randomBytes(512 * 1024) : new Uint8Array([0, 0]) }],
          operations: { operation: "fingerprint" },
        });
      }
      const before = await relation(client);
      const beforeBytes = before.bytes + (await documentBytes(path));
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
        "SELECT extension_id FROM documents JOIN owners ON owners.id=documents.owner_id WHERE NOT (extension_id = 'pstdio' AND key = $1) ORDER BY extension_id",
        [JSON.stringify(["host-local-migration", "first-party-identities-v1"])],
      );
      expect(remaining.rows.map((row) => row.extension_id)).toEqual([...current].sort());
      const saved = await readDocumentHistory(client.db);
      const expectedOwners = (
        await client.pglite.query<{ id: number }>("SELECT id FROM owners WHERE extension_id=ANY($1)", [current])
      ).rows
        .map((row) => row.id)
        .sort((a, b) => a - b);
      for (const rows of [saved.updates, saved.operations])
        expect(rows.map((row) => row.owner_id).sort((a, b) => a - b)).toEqual(expectedOwners);
      expect((await client.pglite.query("SELECT title FROM sessions")).rows).toEqual([
        { title: "Keep this conversation" },
      ]);
      const after = await relation(client);
      expect(after.bytes + (await documentBytes(path))).toBeLessThan(beforeBytes / 2);
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
