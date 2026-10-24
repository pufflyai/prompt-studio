import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PGlite as CurrentPGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "pglite-previous";
import { createDb } from "./connection.pglite";
import { resolveLegacyGitWorkspace } from "./legacy-worktree";
import { migrateThrough } from "./migrate-through";
import * as schema from "./schemas.pg";
import { prepareWorkspaceLocations } from "./workspace-location-migration";

const runGit = promisify(execFile);

test("recovers the actual managed Git worktree source among multiple linked folders", async () => {
  const started = performance.now();
  const phase = (name: string) =>
    process.stderr.write(
      `[legacy worktree] ${new Date().toISOString()} ${name} +${Math.round(performance.now() - started)}ms\n`,
    );
  phase("create temporary fixture");
  const root = await realpath(await mkdtemp(join(tmpdir(), "legacy-worktree-")));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const git = async (path: string, args: string[]) => {
    phase(`git ${args[0]} started`);
    const result = await runGit("git", ["-C", path, ...args]);
    phase(`git ${args[0]} finished`);
    return result;
  };
  try {
    const actual = join(root, "actual");
    const worktree = join(root, "home", "workspaces", "WS-1");
    const prepareGit = async () => {
      const initialized = await Promise.allSettled(
        ["first", "actual"].map(async (name) => {
          const repo = join(root, name);
          await mkdir(repo);
          await git(repo, ["init", "-b", "main"]);
        }),
      );
      for (const result of initialized) if (result.status === "rejected") throw result.reason;
      await writeFile(join(actual, "file.txt"), "actual");
      await git(actual, ["add", "."]);
      await git(actual, ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Base"]);
      await git(actual, ["worktree", "add", "-b", "workspace/WS-1", worktree]);
    };
    const workspace = {
      provider_id: "pstdio.root",
      is_default: false,
      branch: "workspace/WS-1",
      workspace_shorthand: "WS-1",
      worktree_path: worktree,
    };
    const folders = [{ path: join(root, "first") }, { path: join(root, "actual") }];
    const databasePath = join(root, "database");
    phase("open legacy database");
    const old = new PGlite(databasePath);
    try {
      // Neither cold database startup nor real Git fixture creation depends on the other.
      // Await both before migration, without blocking the event loop on Git subprocesses.
      const setup = await Promise.allSettled([prepareGit(), old.waitReady.then(() => phase("legacy database ready"))]);
      for (const result of setup) if (result.status === "rejected") throw result.reason;
      phase("resolve managed worktree source");
      expect(await resolveLegacyGitWorkspace(workspace, folders)).toEqual({
        version: 1,
        data: { sourceRoot: join(root, "actual"), worktreeRoot: worktree, relativePath: "" },
      });
      expect(await resolveLegacyGitWorkspace({ ...workspace, branch: null }, folders)).toBeNull();
      phase("migrate through entry 25");
      await migrateThrough(
        drizzle(old as unknown as CurrentPGlite, { schema }),
        join(import.meta.dir, "../../drizzle"),
        25,
      );
      phase("insert legacy project and workspace records");
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
      phase("migrate through entry 31");
      await migrateThrough(
        drizzle(old as unknown as CurrentPGlite, { schema }),
        join(import.meta.dir, "../../drizzle"),
        31,
      );
      phase("prepare workspace locations");
      await prepareWorkspaceLocations(old as unknown as CurrentPGlite);
      phase("repeat workspace preparation");
      await prepareWorkspaceLocations(old as unknown as CurrentPGlite);
    } finally {
      phase("close legacy database");
      await old.close();
      phase("legacy database closed");
    }
    phase("reopen and upgrade database");
    const upgraded = await createDb({ path: databasePath, onPhase: (name) => phase(`upgrade ${name}`) });
    phase("read upgraded workspace records");
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
      phase("close upgraded database");
      await upgraded.close();
      phase("upgraded database closed");
    }

    phase("check linked worktree exclusion");
    expect(await resolveLegacyGitWorkspace(workspace, [...folders, { path: worktree }])).toBeNull();
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    phase("remove temporary fixture");
    await rm(root, { recursive: true, force: true });
    phase("temporary fixture removed");
  }
}, 15_000);
