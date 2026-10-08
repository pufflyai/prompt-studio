import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { removeArchivedWorkspaces } from "./archived-workspaces-migration";

test("soft-deletes archived workspaces including legacy roots and removes only managed folders", async () => {
  const home = await mkdtemp(join(tmpdir(), "archived-workspaces-"));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = home;
  const owned = join(home, "workspaces", "legacy");
  const external = join(home, "user-project");
  await mkdir(owned, { recursive: true });
  await mkdir(external, { recursive: true });
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE workspaces (
      id text, project_id text, provider_id text, root_path text, branch text,
      provider_ref_json jsonb, archived boolean, is_default boolean, deleted_at text, updated_at text
    );`);
    await db.query(
      `INSERT INTO workspaces VALUES
      ('legacy','p','pstdio.root',$1,null,null,true,false,null,'old'),
      ('external','p','pstdio.root',$2,null,null,true,false,null,'old'),
      ('active','p','pstdio.root',$2,null,null,false,true,null,'old')`,
      [await realpath(owned), external],
    );
    await removeArchivedWorkspaces(db);
    await removeArchivedWorkspaces(db);
    const result = await db.query<{ id: string; deleted_at: string | null }>(
      "SELECT id, deleted_at FROM workspaces ORDER BY id",
    );
    expect(result.rows.filter((row) => row.deleted_at).map((row) => row.id)).toEqual(["external", "legacy"]);
    expect(existsSync(owned)).toBe(false);
    expect(existsSync(external)).toBe(true);
  } finally {
    await db.close();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(home, { recursive: true, force: true });
  }
});
