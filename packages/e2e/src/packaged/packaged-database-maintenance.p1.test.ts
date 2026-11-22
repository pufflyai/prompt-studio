import { beforeAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createDb } from "pstdio-db";
import { createTextLogOwnerFixture, readDocumentHistory, seedDocumentHistory } from "pstdio-db/test-fixtures";
import { editResourceDocument } from "pstdio-sync/records";
import { encodeRecordFrame } from "pstdio-sync/relay";
import { buildBinary } from "./packaged-helpers";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
}, 180_000);

test(
  "the compiled host opens while legacy conversation sync data waits for background cleanup",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-db-maintenance-"));
    const path = join(root, "db.sqlite");
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    try {
      const seed = await createDb({ path });
      try {
        await seed.pglite.exec(
          "INSERT INTO projects (id,name,shorthand,created_at,updated_at) VALUES ('offline','Offline project','P','now','now'); INSERT INTO sessions (id,title,project_id,status,created_at,updated_at) VALUES ('saved-session','Keep this conversation','offline','completed','now','now')",
        );
        const address = [
          "offline",
          JSON.stringify(["pstdio.personal-history", "https://manager.example", "alice"]),
          "transcript",
        ];
        const {
          rows: [owner],
        } = await seed.pglite.query<{ id: number }>(
          "INSERT INTO owners(project_id,extension_id) VALUES ($1,$2) RETURNING id",
          address.slice(0, 2),
        );
        await seedDocumentHistory(seed.db, {
          owner_id: owner!.id,
          document_id: address[2]!,
          state: new Uint8Array([0, 0]),
          revision: 1,
          updates: [{ revision: 1, update: randomBytes(2 * 1024 * 1024) }],
        });
      } finally {
        await seed.close();
      }
      const log = join(root, "startup.jsonl");
      host = await startPackagedServe(root, { PSTDIO_LOG_PATH: log });
      const projects = await fetch(`${host.baseUrl}/v1/projects`, {
        headers: { authorization: `Bearer ${host.descriptor.token}` },
      });
      expect(projects.ok).toBe(true);
      expect(await projects.json()).toEqual([expect.objectContaining({ id: "offline", name: "Offline project" })]);
      await stopProcess(host.child);
      host = undefined;
      const phases = (await Bun.file(log).text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { event?: string; phase?: string })
        .filter((entry) => entry.event === "runtime.startup.phase")
        .map((entry) => entry.phase);
      expect(phases).toContain("app_ready");
      expect(phases).not.toContain("database_cleaning");
      expect(phases).not.toContain("database_compacting");
      // Closing before the scheduled pass leaves its work pending for the next runtime.
      const inspect = await createDb({ path, deferCleanup: true });
      try {
        const history = await readDocumentHistory(inspect.db);
        expect(history.updates.map(({ document_id }) => ({ document_id }))).toEqual([{ document_id: "transcript" }]);
        expect(history.updates[0]!.update.byteLength).toBe(2 * 1024 * 1024);
        expect((await inspect.pglite.query("SELECT title FROM sessions")).rows).toEqual([
          { title: "Keep this conversation" },
        ]);
      } finally {
        await inspect.close();
      }
    } finally {
      if (host) await stopProcess(host.child);
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);

test(
  "the compiled host converts released pending records before admission and keeps them after restart",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-record-admission-"));
    const previous = await createTextLogOwnerFixture(root);
    let previousClosed = false;
    let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    try {
      const resource = await editResourceDocument([], { recordId: "card", replace: { title: "kept" } }, true);
      await previous.pglite.exec(`INSERT INTO projects(id,name,shorthand,created_at,updated_at)
        VALUES ('legacy','Released project','L','now','now');
        INSERT INTO storage_record_sync(workbench_id,extension_id,joined)
          VALUES ('legacy','example.upgrade',true)`);
      await previous.pglite.query(
        `INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
        VALUES ('legacy','example.upgrade','records',decode('0000','hex')),
          ('legacy','example.upgrade','["resource","card"]',$1)`,
        [resource.checkpoint],
      );
      await previous.pglite.exec(`INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
        VALUES ('legacy','example.upgrade','records',1,1)`);
      await previous.pglite.query(
        `INSERT INTO storage_current_records(workbench_id,extension_id,record_id,deleted,value,revision)
        VALUES ('legacy','example.upgrade','card',false,$1,$2)`,
        [JSON.stringify(resource.record.value), resource.record.revision],
      );
      await previous.pglite.query(
        `INSERT INTO storage_record_outbox(workbench_id,extension_id,frame)
        VALUES ('legacy','example.upgrade',$1)`,
        [encodeRecordFrame({ records: [{ recordId: "card", bytes: resource.update! }], assets: [] })],
      );
      await previous.close();
      previousClosed = true;
      let expected: unknown[] = [];
      for (let open = 0; open < 2; open++) {
        host = await startPackagedServe(root, { PSTDIO_DB_PATH: previous.path });
        const response = await fetch(`${host.baseUrl}/v1/projects`, {
          headers: { authorization: `Bearer ${host.descriptor.token}` },
        });
        expect(await response.json()).toContainEqual(
          expect.objectContaining({ id: "legacy", name: "Released project" }),
        );
        await stopProcess(host.child);
        host = undefined;
        // Inspect the closed home directly: source admission must not repair a missing packaged conversion.
        const require = createRequire(import.meta.url);
        const icu = join(dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
        const inspect = new PGlite(previous.path, {
          database: "template1",
          username: "postgres",
          icuDataDir: Bun.file(icu),
        });
        try {
          expect(
            (
              await inspect.query(`SELECT to_regclass('storage_record_sync') AS sync,
            to_regclass('storage_record_outbox') AS outbox,to_regclass('storage_ordered_owners') AS ordered`)
            ).rows,
          ).toEqual([{ sync: null, outbox: null, ordered: null }]);
          const saved = (
            await inspect.query(`SELECT r.value,o.joined,o.epoch FROM records r
            JOIN owners o ON o.id=r.owner_id WHERE o.extension_id='example.upgrade' AND r.revision IS NOT NULL`)
          ).rows;
          expect(saved).toEqual([{ value: { title: "kept" }, joined: true, epoch: null }]);
          const pending = (
            await inspect.query(`SELECT encode(envelope,'hex') AS bytes,operation_id,local_sequence
            FROM operations WHERE envelope IS NOT NULL ORDER BY local_sequence`)
          ).rows;
          expect(pending).toHaveLength(1);
          if (open === 0) expected = pending;
          else expect(pending).toEqual(expected);
        } finally {
          await inspect.close();
        }
      }
    } finally {
      if (host) await stopProcess(host.child);
      if (!previousClosed) await previous.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
