import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, createProjectsDBService, createWorkspacesDBService } from "pstdio-db";
import { git } from "pstdio-wt";
import { setupWorkspaceWorktree } from "./worktree-setup";

test.each([false, true])("isolates workspaces across projects sharing a repository: %s", async (sharedRepo) => {
  const root = mkdtempSync(join(tmpdir(), "workspace-isolation-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const db = await createDb({ path: ":memory:" });
  try {
    const projects = createProjectsDBService(db.db);
    const workspaces = createWorkspacesDBService(db.db);
    const repo = async (name: string) => {
      const path = join(root, name);
      mkdirSync(path);
      await git(path, ["init", "-b", "main"]);
      await git(path, [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "commit",
        "--allow-empty",
        "-m",
        "init",
      ]);
      return path;
    };
    const repoA = await repo("a");
    const repoB = sharedRepo ? repoA : await repo("b");
    const projectA = await projects.create({ name: "Prompt Studio" });
    const projectB = await projects.create({ name: "Paper Stack" });
    const a = await workspaces.create({ project_id: projectA.id });
    const b = await workspaces.create({ project_id: projectB.id });
    const first = await setupWorkspaceWorktree({
      repoPath: repoA,
      workspaceShorthand: a.workspace_shorthand,
      base: "main",
    });
    writeFileSync(join(first.worktreePath, "private.txt"), "first workspace edits");
    const second = await setupWorkspaceWorktree({
      repoPath: repoB,
      workspaceShorthand: b.workspace_shorthand,
      base: "main",
    });
    expect(second.worktreePath).not.toBe(first.worktreePath);
    expect(second.branch).not.toBe(first.branch);
    const retry = await setupWorkspaceWorktree({
      branch: first.branch,
      worktreePath: first.worktreePath,
      repoPath: repoA,
      workspaceShorthand: a.workspace_shorthand,
      base: "main",
    });
    expect(retry.branch).toBe(first.branch);
    expect(realpathSync(retry.worktreePath)).toBe(realpathSync(first.worktreePath));
    expect(readFileSync(join(retry.worktreePath, "private.txt"), "utf8")).toBe("first workspace edits");
  } finally {
    await db.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  }
});
