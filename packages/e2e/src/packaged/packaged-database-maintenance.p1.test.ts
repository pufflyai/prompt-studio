import { beforeAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "pstdio-db";
import { buildBinary } from "./packaged-helpers";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

beforeAll(() => {
  if (!process.env.E2E_PACKAGED_BINARY_PATH) buildBinary();
}, 180_000);

const directoryBytes = async (path: string): Promise<number> => {
  const entries = await readdir(path, { withFileTypes: true });
  const sizes = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? directoryBytes(join(path, entry.name)) : stat(join(path, entry.name)).then((s) => s.size),
    ),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
};

test(
  "the compiled host removes legacy conversation sync data offline and returns its space",
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
        await seed.pglite.query(
          "INSERT INTO storage_documents (workbench_id,extension_id,document_id,state) VALUES ($1,$2,$3,$4)",
          [...address, new Uint8Array([0, 0])],
        );
        await seed.pglite.query(
          "INSERT INTO storage_document_updates (workbench_id,extension_id,document_id,revision,update) VALUES ($1,$2,$3,1,$4)",
          [...address, randomBytes(2 * 1024 * 1024)],
        );
      } finally {
        await seed.close();
      }
      const before = await directoryBytes(join(path, "base"));
      host = await startPackagedServe(root);
      const projects = await fetch(`${host.baseUrl}/v1/projects`, {
        headers: { authorization: `Bearer ${host.descriptor.token}` },
      });
      expect(projects.ok).toBe(true);
      expect(await projects.json()).toEqual([expect.objectContaining({ id: "offline", name: "Offline project" })]);
      await stopProcess(host.child);
      host = undefined;
      // Measure before opening a source connection so source cleanup cannot hide a broken binary.
      expect(await directoryBytes(join(path, "base"))).toBeLessThan(before - 1024 * 1024);
      const inspect = await createDb({ path });
      try {
        expect((await inspect.pglite.query("SELECT * FROM storage_document_updates")).rows).toEqual([]);
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
