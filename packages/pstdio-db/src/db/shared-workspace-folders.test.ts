import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createWorkspacesDBService } from "../services/workspaces/workspaces";
import { createDb } from "./connection.pglite";
import { migrateThrough } from "./migrate-through";
import * as schema from "./schemas.pg";

test("upgrading keeps one workspace per folder and rejects new ones in a used folder", async () => {
  const root = await mkdtemp(join(tmpdir(), "shared-workspace-folders-"));
  const folder = join(root, "database");
  const old = new PGlite();
  await old.waitReady;
  let image: Blob;
  try {
    await migrateThrough(drizzle(old, { schema }), join(import.meta.dir, "../../drizzle"), 32);
    await old.transaction(async (seed) => {
      for (const id of ["home", "first", "second", "live", "gone"])
        await seed.query(
          "INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES ($1,$1,$1,'2026-01-01','2026-01-01')",
          [id],
        );
      for (const [id, project, path, isDefault, createdAt] of [
        ["home-default", "home", "/home", true, "2026-01-01"],
        ["home-extra", "home", "/home", false, "2026-02-01"],
        ["first-worktree", "first", "/workspaces/WS-1", false, "2026-01-01"],
        ["second-worktree", "second", "/workspaces/WS-1", false, "2026-02-01"],
        ["first-remote", "first", null, false, "2026-01-01"],
        ["second-remote", "second", null, false, "2026-01-01"],
        ["live-default", "live", "/reused", true, "2026-01-01"],
        ["gone-default", "gone", "/reused", true, "2026-02-01"],
      ] as const)
        await seed.query(
          "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,root_path,is_default,created_at,updated_at) VALUES ($1,$2,$1,$1,$3,$4,$5,$5)",
          [id, project, path, isDefault, createdAt],
        );
      await seed.query("UPDATE projects SET deleted_at = '2026-03-01' WHERE id = 'gone'");
      await seed.query(
        "INSERT INTO sessions(id,project_id,title,created_at,updated_at) VALUES ('session','home','History','2026-01-01','2026-01-01')",
      );
      await seed.query(
        "INSERT INTO workspace_sessions(id,workspace_id,session_id,created_at) VALUES ('link','home-extra','session','2026-01-01')",
      );
    });
    image = await old.dumpDataDir("none");
  } finally {
    await old.close();
  }
  await new Bun.Archive(image).extract(folder);
  const upgraded = await createDb({ path: folder });
  try {
    const records = await upgraded.db.select().from(schema.workspaces);
    const active = records.filter((row) => !row.deleted_at).map((row) => row.id);
    expect(active.sort()).toEqual(["first-remote", "home-default", "live-default", "second-remote", "second-worktree"]);
    expect(await upgraded.db.select().from(schema.workspace_sessions)).toMatchObject([
      { workspace_id: "home-extra", session_id: "session" },
    ]);
    const workspaces = createWorkspacesDBService(upgraded.db);
    await expect(workspaces.createStandalone({ project_id: "home", root_path: "/home" })).rejects.toThrow();
  } finally {
    await upgraded.close();
    await rm(root, { recursive: true, force: true });
  }
});
