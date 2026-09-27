import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createWorkspacesDBService } from "../services/workspaces/workspaces";
import { createDb } from "./connection.pglite";
import { migrateThrough } from "./migrate-through";
import * as schema from "./schemas.pg";

test("upgrades linked folders and recorded aliases without losing workspace or session identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-location-upgrade-"));
  const folder = join(root, "database");
  const projectFolder = join(root, "project");
  const alias = join(root, "alias");
  await mkdir(projectFolder);
  await symlink(projectFolder, alias);
  const old = new PGlite(folder);
  await old.waitReady;
  try {
    await migrateThrough(drizzle(old, { schema }), join(import.meta.dir, "../../drizzle"), 31);
    // Seed the old schema atomically instead of flushing every fixture row to disk.
    await old.transaction(async (seed) => {
      for (const id of ["zero", "one", "many", "recorded"])
        await seed.query(
          "INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES ($1,$1,$1,'2026-01-01','2026-01-01')",
          [id],
        );
      for (const [id, path] of [
        ["a", "/first"],
        ["b", "/second"],
      ])
        await seed.query(
          "INSERT INTO repos(id,name,path,created_at,updated_at) VALUES ($1,$1,$2,'2026-01-01','2026-01-01')",
          [id, path],
        );
      for (const [id, project, repo] of [
        ["z", "many", "b"],
        ["a", "many", "a"],
        ["one-link", "one", "b"],
        ["recorded-link", "recorded", "a"],
      ])
        await seed.query("INSERT INTO project_repos(id,project_id,repo_id,created_at) VALUES ($1,$2,$3,'2026-01-01')", [
          id,
          project,
          repo,
        ]);
      await seed.query(
        "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,worktree_path,is_default,created_at,updated_at) VALUES ('recorded-home','recorded','Default','default',$1,true,'2026-01-01','2026-01-01')",
        [alias],
      );
      await seed.query(
        "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,worktree_path,provider_id,provider_params_json,created_at,updated_at) VALUES ('other-workspace','many','Other','WS-1','/isolated','pstdio.worktree',$1,'2026-01-01','2026-01-01')",
        [{ repo_id: "b" }],
      );
      await seed.query(
        "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,provider_id,execution_kind,provider_ref_json,provider_params_json,created_at,updated_at) VALUES ('cloud-workspace','many','Cloud','WS-2','cloud','remote',$1,$2,'2026-01-01','2026-01-01')",
        [
          { version: 1, data: { id: "remote" } },
          { repo_id: "provider-owned-source", image: "documents" },
        ],
      );
      await seed.query(
        "INSERT INTO sessions(id,project_id,title,created_at,updated_at) VALUES ('session','many','History','2026-01-01','2026-01-01')",
      );
      await seed.query(
        "INSERT INTO workspace_sessions(id,workspace_id,session_id,created_at) VALUES ('link','other-workspace','session','2026-01-01')",
      );
    });
  } finally {
    await old.close();
  }
  const upgraded = await createDb({ path: folder });
  try {
    const records = await upgraded.db.select().from(schema.workspaces);
    expect(records.find((row) => row.project_id === "zero")).toBeUndefined();
    expect(records.find((row) => row.project_id === "one" && row.is_default)?.root_path).toBe("/second");
    expect(records.find((row) => row.project_id === "many" && row.is_default)?.root_path).toBe("/first");
    const workspaces = createWorkspacesDBService(upgraded.db);
    const home = await workspaces.findDefaultByPath(await realpath(alias));
    expect(home).toMatchObject({
      id: "recorded-home",
      project_id: "recorded",
      root_path: await realpath(projectFolder),
    });
    expect(records.find((row) => row.id === "other-workspace")).toMatchObject({
      root_path: "/isolated",
      provider_ref_json: { data: { sourceRoot: "/second", worktreeRoot: "/isolated" } },
    });
    expect(records.find((row) => row.id === "cloud-workspace")).toMatchObject({
      root_path: null,
      provider_ref_json: { version: 1, data: { id: "remote" } },
      provider_params_json: { repo_id: "provider-owned-source", image: "documents" },
    });
    expect(await upgraded.db.select().from(schema.workspace_sessions)).toMatchObject([
      { id: "link", workspace_id: "other-workspace", session_id: "session" },
    ]);
    expect((await upgraded.db.select().from(schema.projects)).length).toBe(4);
  } finally {
    await upgraded.close();
    await rm(root, { recursive: true, force: true });
  }
});
