import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyPstdioConfig } from "./worktree-setup";

describe("copyPstdioConfig", () => {
  let repoPath: string;
  let worktreePath: string;

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), "wt-repo-"));
    worktreePath = mkdtempSync(join(tmpdir(), "wt-tree-"));
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
    rmSync(worktreePath, { recursive: true, force: true });
  });

  const writeSourceConfig = async (config: Record<string, unknown>) => {
    await mkdir(join(repoPath, ".pstdio"), { recursive: true });
    await writeFile(join(repoPath, ".pstdio", "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  };

  const readWorktreeConfig = () => JSON.parse(readFileSync(join(worktreePath, ".pstdio", "config.json"), "utf8"));

  it("writes the workspace id and preserves existing project fields", async () => {
    await writeSourceConfig({ project_id: "proj_1", extra: "keep" });

    await copyPstdioConfig(repoPath, worktreePath, "ws_host_1");

    expect(readWorktreeConfig()).toEqual({ project_id: "proj_1", extra: "keep", workspace_id: "ws_host_1" });
  });

  it("does not write when the source config is missing", async () => {
    await copyPstdioConfig(repoPath, worktreePath, "ws_host_1");

    expect(existsSync(join(worktreePath, ".pstdio", "config.json"))).toBe(false);
  });
});
