import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";
import { resolveWorkspacesRoot } from "./worktree-setup";

const ownedWorktree = (sourceRoot: string, worktreeRoot: string) => ({
  provider_id: "pstdio.worktree",
  branch: "workspace/WS-1",
  provider_ref_json: { version: 1, data: { sourceRoot, worktreeRoot, relativePath: "" } },
});

describe("workspace resource ownership", () => {
  test("treats an already-missing managed worktree as cleaned", async () => {
    const path = join(resolveWorkspacesRoot(), crypto.randomUUID());
    expect(await cleanupWorkspaceWorktree({} as never, ownedWorktree("/missing-source", path))).toBe(true);
  });

  test("removes an orphaned managed worktree when its repository is gone", async () => {
    const source = join(tmpdir(), `missing-${crypto.randomUUID()}`);
    const path = join(resolveWorkspacesRoot(), crypto.randomUUID());
    mkdirSync(path, { recursive: true });
    try {
      expect(await cleanupWorkspaceWorktree({} as never, ownedWorktree(source, path))).toBe(true);
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(path, { recursive: true, force: true });
    }
  });

  test("preserves user-selected folders and paths outside managed resources", async () => {
    const path = mkdtempSync(join(tmpdir(), "pstdio-folder-preserved-"));
    try {
      expect(await cleanupWorkspaceWorktree({} as never, { provider_id: "pstdio.root", branch: null })).toBe(false);
      expect(await cleanupWorkspaceWorktree({} as never, ownedWorktree(path, path))).toBe(false);
      expect(await cleanupWorkspaceWorktree({} as never, ownedWorktree("/missing", path))).toBe(false);
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(path, { recursive: true, force: true });
    }
  });
});

test("cleans migrated canonical paths under a symlinked managed home", async () => {
  const root = mkdtempSync(join(tmpdir(), "managed-home-"));
  const previous = process.env.PSTDIO_HOME;
  const home = join(root, "home");
  const alias = join(root, "alias");
  mkdirSync(join(home, "workspaces", "owned"), { recursive: true });
  symlinkSync(home, alias, "junction");
  process.env.PSTDIO_HOME = alias;
  const path = realpathSync(join(home, "workspaces", "owned"));
  try {
    expect(await cleanupWorkspaceWorktree({} as never, ownedWorktree(join(root, "missing"), path))).toBe(true);
    expect(existsSync(path)).toBe(false);
    expect(
      await cleanupWorkspaceWorktree(
        {} as never,
        ownedWorktree(join(root, "missing"), join(alias, "workspaces", "owned")),
      ),
    ).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("preserves a source folder referenced through another managed-home alias", async () => {
  const root = mkdtempSync(join(tmpdir(), "managed-source-alias-"));
  const previous = process.env.PSTDIO_HOME;
  const home = join(root, "home");
  const alias = join(root, "alias");
  const source = join(home, "workspaces", "source");
  mkdirSync(source, { recursive: true });
  symlinkSync(home, alias, "junction");
  process.env.PSTDIO_HOME = home;
  try {
    expect(
      await cleanupWorkspaceWorktree({} as never, ownedWorktree(join(alias, "workspaces", "source"), source)),
    ).toBe(false);
    expect(existsSync(source)).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
