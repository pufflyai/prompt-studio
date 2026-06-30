import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureWorkspaceConfig } from "./workspace-config";

describe("ensureWorkspaceConfig", () => {
  let repoPath: string;
  let worktreePath: string;

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), "ws-repo-"));
    worktreePath = mkdtempSync(join(tmpdir(), "ws-tree-"));
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(worktreePath, { recursive: true, force: true });
  });

  const writeConfig = async (dir: string, config: Record<string, unknown>) => {
    await mkdir(join(dir, ".pstdio"), { recursive: true });
    await writeFile(join(dir, ".pstdio", "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  };

  const readConfig = (dir: string) => JSON.parse(readFileSync(join(dir, ".pstdio", "config.json"), "utf8"));

  it("copies the project config and stamps the workspace id for a fresh working dir (worktree)", async () => {
    await writeConfig(repoPath, { project_id: "proj_1", extra: "keep" });

    await ensureWorkspaceConfig(worktreePath, repoPath, "ws_host_1");

    expect(readConfig(worktreePath)).toEqual({ project_id: "proj_1", extra: "keep", workspace_id: "ws_host_1" });
  });

  it("merges the workspace id into an existing config (root workspace at the repo root)", async () => {
    await writeConfig(repoPath, { project_id: "proj_1" });

    await ensureWorkspaceConfig(repoPath, repoPath, "ws_root_1");

    expect(readConfig(repoPath)).toEqual({ project_id: "proj_1", workspace_id: "ws_root_1" });
  });

  it("does nothing when no source config exists", async () => {
    await ensureWorkspaceConfig(worktreePath, repoPath, "ws_host_1");

    expect(existsSync(join(worktreePath, ".pstdio", "config.json"))).toBe(false);
  });

  it("stamps the workspace id even when the working dir already has a config", async () => {
    await writeConfig(repoPath, { project_id: "proj_1" });
    await writeConfig(worktreePath, { project_id: "proj_1", existing: "value" });

    await ensureWorkspaceConfig(worktreePath, repoPath, "ws_host_2");

    // Reads the destination config (already present in the checkout), preserves it, adds the id.
    expect(readConfig(worktreePath)).toEqual({ project_id: "proj_1", existing: "value", workspace_id: "ws_host_2" });
  });
});
