import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createDb } from "./connection.pglite";
import { resolveLegacyGitWorkspace } from "./legacy-worktree";
import { migrateThrough } from "./migrate-through";
import * as schema from "./schemas.pg";
import { prepareWorkspaceLocations } from "./workspace-location-migration";

test("recovers the actual managed Git worktree source among multiple linked folders", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "legacy-worktree-")));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const git = (path: string, args: string[]) => execFileSync("git", ["-C", path, ...args], { stdio: "pipe" });
  try {
    for (const name of ["first", "actual"]) {
      const repo = join(root, name);
      await mkdir(repo);
      git(repo, ["init", "-b", "main"]);
      git(repo, ["config", "user.name", "Test"]);
      git(repo, ["config", "user.email", "test@example.com"]);
      await writeFile(join(repo, "file.txt"), name);
      git(repo, ["add", "."]);
      git(repo, ["commit", "-m", "Base"]);
    }
    const worktree = join(root, "home", "workspaces", "WS-1");
    git(join(root, "actual"), ["worktree", "add", "-b", "workspace/WS-1", worktree]);
    const workspace = {
      provider_id: "pstdio.root",
      is_default: false,
      branch: "workspace/WS-1",
      workspace_shorthand: "WS-1",
      worktree_path: worktree,
    };
    const folders = [{ path: join(root, "first") }, { path: join(root, "actual") }];
    expect(await resolveLegacyGitWorkspace(workspace, folders)).toEqual({
      version: 1,
      data: { sourceRoot: join(root, "actual"), worktreeRoot: worktree, relativePath: "" },
    });
    expect(await resolveLegacyGitWorkspace({ ...workspace, branch: null }, folders)).toBeNull();
    const databasePath = join(root, "database");
    const old = new PGlite(databasePath);
    await old.waitReady;
    try {
      await migrateThrough(drizzle(old, { schema }), join(import.meta.dir, "../../drizzle"), 25);
      await old.query(
        "INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES ('project','Existing','P','2026-01-01','2026-01-01')",
      );
      for (const [index, folder] of folders.entries()) {
        await old.query(
          "INSERT INTO repos(id,name,path,created_at,updated_at) VALUES ($1,$1,$2,'2026-01-01','2026-01-01')",
          [String(index), folder.path],
        );
        await old.query(
          "INSERT INTO project_repos(id,project_id,repo_id,created_at) VALUES ($1,'project',$1,'2026-01-01')",
          [String(index)],
        );
      }
      await old.query(
        "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,worktree_path,branch,created_at,updated_at) VALUES ('isolated','project','Existing','WS-1',$1,'workspace/WS-1','2026-01-01','2026-01-01')",
        [worktree],
      );
      await old.query(
        "INSERT INTO workspaces(id,project_id,name,workspace_shorthand,worktree_path,created_at,updated_at) VALUES ('shared','project','Shared','WS-2',$1,'2026-01-01','2026-01-01')",
        [folders[1]!.path],
      );
      await migrateThrough(drizzle(old, { schema }), join(import.meta.dir, "../../drizzle"), 31);
      await prepareWorkspaceLocations(old);
      await prepareWorkspaceLocations(old);
    } finally {
      await old.close();
    }
    const upgraded = await createDb({ path: databasePath });
    try {
      const rows = await upgraded.db.select().from(schema.workspaces);
      expect(rows.find((row) => row.id === "isolated")).toMatchObject({
        name: "Existing",
        provider_id: "pstdio.worktree",
        provider_capabilities_json: { diff: true, merge: true },
        provider_ref_json: { data: { sourceRoot: folders[1]!.path, worktreeRoot: worktree } },
      });
      expect(rows.find((row) => row.id === "shared")).toMatchObject({
        provider_id: "pstdio.root",
        provider_capabilities_json: { diff: false, delete: false },
        root_path: folders[1]!.path,
      });
      expect(rows.find((row) => row.is_default)).toMatchObject({ root_path: folders[0]!.path });
      expect(rows).toHaveLength(3);
    } finally {
      await upgraded.close();
    }

    expect(await resolveLegacyGitWorkspace(workspace, [...folders, { path: worktree }])).toBeNull();
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});
