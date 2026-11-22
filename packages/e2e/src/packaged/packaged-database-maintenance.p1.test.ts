import { beforeAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "pstdio-db";
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
        await seed.pglite.query("INSERT INTO storage_documents (owner_id,document_id,state) VALUES ($1,$2,$3)", [
          owner!.id,
          address[2],
          new Uint8Array([0, 0]),
        ]);
        await seed.pglite.query(
          "INSERT INTO storage_document_updates (owner_id,document_id,revision,update) VALUES ($1,$2,1,$3)",
          [owner!.id, address[2], randomBytes(2 * 1024 * 1024)],
        );
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
        expect((await inspect.pglite.query("SELECT document_id FROM storage_document_updates")).rows).toEqual([
          { document_id: "transcript" },
        ]);
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
