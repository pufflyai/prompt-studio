import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeWorkspaceWorktreeConfig } from "./worktree-setup";

let tempRoot: string;
let repoPath: string;
let worktreePath: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-worktree-config-test-"));
  repoPath = join(tempRoot, "repo");
  worktreePath = join(tempRoot, "worktree");
  mkdirSync(repoPath, { recursive: true });
  mkdirSync(worktreePath, { recursive: true });
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("writeWorkspaceWorktreeConfig", () => {
  test("writes workspace_id alongside project_id when source config exists", async () => {
    mkdirSync(join(repoPath, ".pstdio"), { recursive: true });
    writeFileSync(join(repoPath, ".pstdio", "config.json"), '{"project_id":"proj-1"}\n');

    await writeWorkspaceWorktreeConfig({ repoPath, worktreePath, workspaceId: "workspace-1" });

    const parsed = JSON.parse(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8"));
    expect(parsed).toEqual({ project_id: "proj-1", workspace_id: "workspace-1" });
  });

  test("preserves any extra fields from the source project config", async () => {
    mkdirSync(join(repoPath, ".pstdio"), { recursive: true });
    writeFileSync(join(repoPath, ".pstdio", "config.json"), '{"project_id":"proj-1","custom":"value"}\n');

    await writeWorkspaceWorktreeConfig({ repoPath, worktreePath, workspaceId: "workspace-1" });

    const parsed = JSON.parse(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8"));
    expect(parsed).toEqual({ project_id: "proj-1", custom: "value", workspace_id: "workspace-1" });
  });

  test("writes workspace_id even when no source config exists", async () => {
    await writeWorkspaceWorktreeConfig({ repoPath, worktreePath, workspaceId: "workspace-1" });

    const parsed = JSON.parse(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8"));
    expect(parsed).toEqual({ workspace_id: "workspace-1" });
  });

  test("no-ops when no workspace id and no source config", async () => {
    await writeWorkspaceWorktreeConfig({ repoPath, worktreePath });

    expect(existsSync(join(worktreePath, ".pstdio", "config.json"))).toBe(false);
  });

  test("copies project config as-is when no workspace id is provided", async () => {
    mkdirSync(join(repoPath, ".pstdio"), { recursive: true });
    writeFileSync(join(repoPath, ".pstdio", "config.json"), '{"project_id":"proj-1"}\n');

    await writeWorkspaceWorktreeConfig({ repoPath, worktreePath });

    const parsed = JSON.parse(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8"));
    expect(parsed).toEqual({ project_id: "proj-1" });
  });
});
