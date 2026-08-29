import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { syncRepoExtensionsForLinkedRepos, syncRepoExtensionsForProject } from "./repo-extensions";

let close: (() => Promise<void>) | undefined;
let projectService: ReturnType<typeof createProjectService>;
let extensionService: ReturnType<typeof createExtensionService>;
let installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
let tempRoot: string;

const writeExtension = (dir: string, name: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      displayName: name,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
};

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-repo-extensions-"));
  projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionInstancesService = createExtensionInstancesDBService(result.db);
  extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService: createExtensionUserDataDBService(result.db),
    projectService,
  });
});

afterEach(async () => {
  await close?.();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("syncRepoExtensionsForProject", () => {
  test("discovers repo-local extensions and enables them for a project", async () => {
    const project = await projectService.create({ name: "Repo Extensions" });
    const repoPath = join(tempRoot, "repo");
    const extensionPath = join(repoPath, ".pstdio", "extensions", "worktree-bootstrap");
    writeExtension(extensionPath, "worktree-bootstrap");

    const result = await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });

    const installed = await installedExtensionSourcesService.getBySourcePath(extensionPath);
    const instances = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });

    expect(result).toEqual({ conflicting: [], enabled: ["worktree-bootstrap"], missing: [], skipped: [] });
    expect(installed).toMatchObject({
      install_name: "worktree-bootstrap",
      source_kind: "local_path",
      source_path: extensionPath,
      status: "loaded",
    });
    expect(instances).toHaveLength(1);
    expect(instances[0]?.enabled).toBe(true);
  });

  test("keeps a repo-local extension disabled during later discovery", async () => {
    const project = await projectService.create({ name: "Disabled Repo Extension" });
    const repoPath = join(tempRoot, "repo");
    const extensionPath = join(repoPath, ".pstdio", "extensions", "worktree-bootstrap");
    writeExtension(extensionPath, "worktree-bootstrap");

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });
    const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });
    expect(instance).toBeDefined();
    await extensionService.setProjectExtensionEnabled(instance!.id, false);

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });

    const disabled = await extensionInstancesService.get(instance!.id);
    expect(disabled?.enabled).toBe(false);
  });

  test("marks removed repo-local folders missing without deleting rows", async () => {
    const project = await projectService.create({ name: "Repo Extensions" });
    const repoPath = join(tempRoot, "repo");
    const extensionPath = join(repoPath, ".pstdio", "extensions", "worktree-bootstrap");
    writeExtension(extensionPath, "worktree-bootstrap");

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });
    const installed = await installedExtensionSourcesService.getBySourcePath(extensionPath);
    const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });

    rmSync(extensionPath, { recursive: true, force: true });
    const result = await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });

    const missing = installed ? await installedExtensionSourcesService.get(installed.id) : null;
    const disabled = instance ? await extensionInstancesService.get(instance.id) : null;

    expect(result).toEqual({ conflicting: [], enabled: [], missing: ["worktree-bootstrap"], skipped: [] });
    expect(missing?.status).toBe("missing");
    expect(disabled?.enabled).toBe(false);
  });

  test("marks invalid repo-local folders missing when package.json is deleted", async () => {
    const project = await projectService.create({ name: "Repo Extensions" });
    const repoPath = join(tempRoot, "repo");
    const extensionPath = join(repoPath, ".pstdio", "extensions", "worktree-bootstrap");
    writeExtension(extensionPath, "worktree-bootstrap");

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });
    const installed = await installedExtensionSourcesService.getBySourcePath(extensionPath);
    const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });

    rmSync(join(extensionPath, "package.json"), { force: true });
    const result = await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });

    const missing = installed ? await installedExtensionSourcesService.get(installed.id) : null;
    const disabled = instance ? await extensionInstancesService.get(instance.id) : null;

    expect(result).toEqual({
      conflicting: [],
      enabled: [],
      missing: ["worktree-bootstrap"],
      skipped: ["worktree-bootstrap"],
    });
    expect(missing?.status).toBe("missing");
    expect(disabled?.enabled).toBe(false);
  });

  test("marks repo-local folders missing when discovery is disabled", async () => {
    const project = await projectService.create({ name: "Repo Extensions" });
    const repoPath = join(tempRoot, "repo");
    const extensionPath = join(repoPath, ".pstdio", "extensions", "worktree-bootstrap");
    writeExtension(extensionPath, "worktree-bootstrap");

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });
    const installed = await installedExtensionSourcesService.getBySourcePath(extensionPath);
    const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });

    const result = await syncRepoExtensionsForProject({
      discover: false,
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });

    const missing = installed ? await installedExtensionSourcesService.get(installed.id) : null;
    const disabled = instance ? await extensionInstancesService.get(instance.id) : null;

    expect(result).toEqual({ conflicting: [], enabled: [], missing: ["worktree-bootstrap"], skipped: [] });
    expect(missing?.status).toBe("missing");
    expect(disabled?.enabled).toBe(false);
  });

  test("syncs every linked repo in deterministic path order", async () => {
    const project = await projectService.create({ name: "Repo Extensions" });
    const repoA = join(tempRoot, "a");
    const repoB = join(tempRoot, "b");
    writeExtension(join(repoB, ".pstdio", "extensions", "repo-b"), "repo-b");
    writeExtension(join(repoA, ".pstdio", "extensions", "repo-a"), "repo-a");

    const result = await syncRepoExtensionsForLinkedRepos({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoService: {
        listByProject: async () => [
          { id: "repo-b", path: repoB },
          { id: "repo-a", path: repoA },
        ],
      },
    });

    expect(result.flatMap((entry) => entry.enabled)).toEqual(["repo-a", "repo-b"]);
  });

  test("a second repo claiming a running extension id is registered disabled", async () => {
    const project = await projectService.create({ name: "Repo Extensions" });
    const repoA = join(tempRoot, "a");
    const repoB = join(tempRoot, "b");
    writeExtension(join(repoA, ".pstdio", "extensions", "shared-tool"), "shared-tool");
    writeExtension(join(repoB, ".pstdio", "extensions", "shared-tool"), "shared-tool");
    const repoService = {
      listByProject: async () => [
        { id: "repo-b", path: repoB },
        { id: "repo-a", path: repoA },
      ],
    };

    const first = await syncRepoExtensionsForLinkedRepos({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoService,
    });

    expect(first.flatMap((entry) => entry.enabled)).toEqual(["shared-tool"]);
    expect(first.flatMap((entry) => entry.conflicting)).toEqual(["shared-tool"]);

    // Discovery repeats on every repo link change, so the winner must not move.
    await syncRepoExtensionsForLinkedRepos({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoService,
    });

    const enabledSources = await extensionService.listEnabledSourcesForProject(project.id);
    expect(enabledSources.map(({ installedSource }) => installedSource.source_path)).toEqual([
      join(repoA, ".pstdio", "extensions", "shared-tool"),
    ]);

    const all = await extensionService.listProjectExtensionInstances(project.id);
    expect(all).toHaveLength(2);
  });
});
