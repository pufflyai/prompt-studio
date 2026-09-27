import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { ensureWorkspaceConfig, removeWorkspaceConfig } from "./workspace-config";

describe("workspace config ownership", () => {
  let host: Awaited<ReturnType<typeof createTestApp>>;
  let repoPath: string;
  let worktreePath: string;
  let projectId: string;
  let homeId: string;
  let workspaceId: string;
  beforeAll(async () => {
    host = await createTestApp();
  });
  afterAll(async () => {
    await host.close();
  });
  beforeEach(async () => {
    repoPath = realpathSync(mkdtempSync(join(tmpdir(), "ws-repo-")));
    worktreePath = realpathSync(mkdtempSync(join(tmpdir(), "ws-tree-")));
    projectId = (await host.deps.projectService.create({ name: "Config test" })).id;
    homeId = (
      await host.deps.workspaceService.ensureDefault({
        project_id: projectId,
        root_path: repoPath,
        name: "Project folder",
      })
    ).id;
    workspaceId = (
      await host.deps.workspaceService.createStandalone({ project_id: projectId, root_path: worktreePath })
    ).id;
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
  const ensure = (dir: string, id: string) => ensureWorkspaceConfig(dir, repoPath, id, projectId, host.deps);

  it("copies matching project fields into a fresh workspace config", async () => {
    await writeConfig(repoPath, { project_id: projectId, extra: "keep" });
    await ensure(worktreePath, workspaceId);
    expect(readConfig(worktreePath)).toEqual({ project_id: projectId, extra: "keep", workspace_id: workspaceId });
    expect(readFileSync(join(worktreePath, ".pstdio", ".gitignore"), "utf8")).toBe("config.json\n");
  });

  it("upgrades legacy project bindings without losing fields", async () => {
    await writeConfig(repoPath, { project_id: projectId, extra: "keep" });
    await ensure(repoPath, homeId);
    expect(readConfig(repoPath)).toEqual({ project_id: projectId, workspace_id: homeId, extra: "keep" });
  });

  it("uses the expected project identity when no source config exists", async () => {
    await ensure(worktreePath, workspaceId);
    expect(readConfig(worktreePath)).toEqual({ project_id: projectId, workspace_id: workspaceId });
  });

  it("updates a copied home binding in a new worktree and preserves its fields", async () => {
    await writeConfig(worktreePath, { project_id: projectId, workspace_id: homeId, existing: "value" });
    await ensure(worktreePath, workspaceId);
    expect(readConfig(worktreePath)).toEqual({ project_id: projectId, existing: "value", workspace_id: workspaceId });
  });

  it("allows only one owner when independent claims race for an empty folder", async () => {
    const other = await host.deps.projectService.create({ name: "Other host" });
    const otherWorkspace = await host.deps.workspaceService.ensureDefault({
      project_id: other.id,
      root_path: worktreePath,
      name: "Other folder",
    });
    const results = await Promise.allSettled([
      ensure(worktreePath, workspaceId),
      ensureWorkspaceConfig(worktreePath, worktreePath, otherWorkspace.id, other.id, host.deps),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const winner =
      results[0]!.status === "fulfilled"
        ? { project_id: projectId, workspace_id: workspaceId }
        : { project_id: other.id, workspace_id: otherWorkspace.id };
    expect(readConfig(worktreePath)).toEqual(winner);
  });

  it("leaves malformed configs untouched during setup and deletion", async () => {
    await mkdir(join(repoPath, ".pstdio"), { recursive: true });
    const path = join(repoPath, ".pstdio/config.json");
    await writeFile(path, "user content");
    await expect(ensure(repoPath, homeId)).rejects.toThrow("config");
    await removeWorkspaceConfig(repoPath, projectId, homeId);
    expect(readFileSync(path, "utf8")).toBe("user content");
  });

  it("keeps matching bindings byte-for-byte during retry", async () => {
    await mkdir(join(repoPath, ".pstdio"), { recursive: true });
    const path = join(repoPath, ".pstdio/config.json");
    const content = JSON.stringify({ project_id: projectId, workspace_id: homeId, custom: "keep" });
    await writeFile(path, content);
    await ensure(repoPath, homeId);
    expect(readFileSync(path, "utf8")).toBe(content);
  });
});
