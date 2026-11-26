import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, type DbOpenPhase } from "./connection.pglite";

test("an orphan survives opening and an interrupted idle pass, then is collected after restart", async () => {
  const home = await mkdtemp(join(tmpdir(), "pstdio-idle-collection-"));
  const path = join(home, "db");
  const folder = join(`${path}-documents`, "p-61", "1");
  const orphan = join(folder, "unreferenced");
  let handle: Awaited<ReturnType<typeof createDb>> | undefined;
  try {
    await mkdir(folder, { recursive: true });
    await Bun.write(orphan, "abandoned");
    handle = await createDb({ path, deferCleanup: true });
    expect(existsSync(orphan)).toBe(true);
    await handle.cleanupRetiredRows(() => true);
    expect(existsSync(orphan)).toBe(true);
    await handle.close();
    handle = await createDb({ path, deferCleanup: true });
    expect(existsSync(orphan)).toBe(true);
    await handle.cleanupRetiredRows(() => false);
    expect(existsSync(orphan)).toBe(false);
  } finally {
    await handle?.close();
    await rm(home, { recursive: true, force: true });
  }
}, 30000);

test("only a clean, matching database checkpoint skips completed file and identity conversions", async () => {
  const home = await mkdtemp(join(tmpdir(), "pstdio-admission-"));
  const path = join(home, "db");
  const phases: DbOpenPhase[] = [];
  const open = () => createDb({ path, deferCleanup: true, onPhase: (phase) => phases.push(phase) });
  try {
    await (await open()).close();
    expect(phases).toContain("database_index_nodes");
    phases.length = 0;
    await (await open()).close();
    expect(phases).not.toContain("database_index_nodes");
    // Opening and writing with a different engine session invalidates the saved control file.
    const other = await createDb({ path });
    try {
      await other.pglite.exec("CREATE TABLE foreign_writer_test(id int)");
    } finally {
      await other.close();
    }
    phases.length = 0;
    await (await open()).close();
    expect(phases).toContain("database_index_nodes");
    // A missing/corrupt checkpoint cannot suppress admission.
    await Bun.write(join(path, ".pstdio-startup-admission"), "truncated");
    phases.length = 0;
    await (await open()).close();
    expect(phases).toContain("database_index_nodes");
    // Changing the retained archive must revalidate mirror access.
    const exports = `${path}-migration-exports`;
    await mkdir(exports, { recursive: true });
    await Bun.write(join(exports, "artifact_file_projection_roots.jsonl"), "invalid\n");
    await expect(open()).rejects.toThrow();
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}, 30000);

test("interrupting an idle sweep releases the database and the next pass finishes it", async () => {
  const home = await mkdtemp(join(tmpdir(), "pstdio-paused-sweep-"));
  const path = join(home, "db");
  const handle = await createDb({ path, deferCleanup: true });
  try {
    const files = await Promise.all(
      Array.from({ length: 40 }, async (_, index) => {
        const directory = join(`${path}-documents`, "p-61", String(index + 1));
        await mkdir(directory, { recursive: true });
        const file = join(directory, "orphan");
        await Bun.write(file, "abandoned");
        return file;
      }),
    );
    await handle.cleanupRetiredRows(() => files.some((file) => !existsSync(file)));
    expect(files.filter(existsSync).length).toBe(24);
    await handle.pglite.exec("SELECT 1");
    await handle.cleanupRetiredRows(() => false);
    expect(files.some(existsSync)).toBe(false);
  } finally {
    await handle.close();
    await rm(home, { recursive: true, force: true });
  }
}, 30000);
