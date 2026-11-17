import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
import { createSyncService } from "../../services/sync-service";
import { EventBus } from "../sync/event-bus";
import { syncRepoExtensionsForProject, syncRepoExtensionsForProjectFolder } from "./repo-extensions";

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
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
};

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-repo-extensions-"));
  projectService = createProjectService({
    syncService: createSyncService({ db: result.db }),
    eventBus: new EventBus(),
    projectsDBService: createProjectsDBService(result.db),
  });
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionInstancesService = createExtensionInstancesDBService(result.db);
  extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService: createExtensionUserDataDBService(result.db),
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
  });
});

afterEach(async () => {
  await close?.();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("syncRepoExtensionsForProject", () => {
  test("leaves a repo copy off when a host-required copy provides its extension id", async () => {
    const previous = { home: process.env.PSTDIO_HOME, catalog: process.env.PSTDIO_EXTENSION_CATALOG };
    process.env.PSTDIO_HOME = join(tempRoot, "home");
    process.env.PSTDIO_EXTENSION_CATALOG = join(tempRoot, "catalog.json");
    try {
      const origin = {
        kind: "git",
        url: "https://github.com/pufflyai/prompt-studio",
        path: "extensions/x",
        ref: "main",
      };
      const entry = { installName: "worktree-bootstrap", displayName: "Bootstrap", description: "", default: false };
      writeFileSync(
        process.env.PSTDIO_EXTENSION_CATALOG,
        JSON.stringify({ version: 1, extensions: [{ ...entry, alwaysEnabled: true, origin }] }),
      );
      const requiredPath = join(process.env.PSTDIO_HOME, "extensions", "worktree-bootstrap");
      writeExtension(requiredPath, "worktree-bootstrap");
      await extensionService.registerInstalledSource({
        displayName: "worktree-bootstrap",
        extensionId: "pstdio.worktree-bootstrap",
        installName: "worktree-bootstrap",
        manifest: {},
        name: "worktree-bootstrap",
        sourcePath: requiredPath,
      });
      const project = await projectService.create({ name: "Required copy" });
      const repoPath = join(tempRoot, "repo");
      writeExtension(join(repoPath, ".pstdio", "extensions", "worktree-bootstrap"), "worktree-bootstrap");

      const result = await syncRepoExtensionsForProject({
        extensionService,
        installedExtensionSourcesService,
        projectId: project.id,
        repoPath,
      });

      expect(result).toMatchObject({ conflicting: ["worktree-bootstrap"], enabled: [], missing: [], skipped: [] });
      expect(await extensionService.listEnabledSourcesForProject(project.id)).toEqual([]);
    } finally {
      if (previous.home === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previous.home;
      if (previous.catalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
      else process.env.PSTDIO_EXTENSION_CATALOG = previous.catalog;
    }
  });

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

    expect(result).toMatchObject({ conflicting: [], enabled: ["worktree-bootstrap"], missing: [], skipped: [] });
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
    writeFileSync(
      join(extensionPath, "extension.ts"),
      'export default { commands: { hello: { title: "Hello", params: {}, run: () => "hello" } } };\n',
    );

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });
    const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });
    expect(instance).toBeDefined();
    await extensionService.setProjectExtensionEnabled(instance!.id, false);
    const accepted = await installedExtensionSourcesService.getBySourcePath(extensionPath);
    expect(accepted?.manifest_json.commands).toEqual(["hello"]);

    await syncRepoExtensionsForProject({
      extensionService,
      installedExtensionSourcesService,
      projectId: project.id,
      repoPath,
    });

    const disabled = await extensionInstancesService.get(instance!.id);
    expect(disabled?.enabled).toBe(false);
    expect((await installedExtensionSourcesService.getBySourcePath(extensionPath))?.manifest_json).toEqual(
      accepted?.manifest_json,
    );
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

    expect(result).toMatchObject({ conflicting: [], enabled: [], missing: ["worktree-bootstrap"], skipped: [] });
    expect(missing?.status).toBe("missing");
    expect(disabled?.enabled).toBe(false);
  });

  test("keeps the accepted repo-local revision when its mutable package.json is deleted", async () => {
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

    expect(result).toMatchObject({
      conflicting: [],
      enabled: ["worktree-bootstrap"],
      missing: [],
      skipped: [],
    });
    expect(missing?.status).toBe("loaded");
    expect(disabled?.enabled).toBe(true);
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

    expect(result).toMatchObject({ conflicting: [], enabled: [], missing: ["worktree-bootstrap"], skipped: [] });
    expect(missing?.status).toBe("missing");
    expect(disabled?.enabled).toBe(false);
  });
});

test("syncs extensions from the default workspace folder", async () => {
  const project = await projectService.create({ name: "Repo Extensions" });
  const repoA = join(tempRoot, "a");
  const repoB = join(tempRoot, "b");
  writeExtension(join(repoB, ".pstdio", "extensions", "repo-b"), "repo-b");
  writeExtension(join(repoA, ".pstdio", "extensions", "repo-a"), "repo-a");

  const workspace = {
    id: "home",
    project_id: "project-1",
    root_path: repoB,
    execution_kind: "local" as const,
    provider_id: "pstdio.root",
    provider_state: "ready" as const,
    initializing: true,
    setup_error: null,
  };
  const input = {
    extensionService,
    installedExtensionSourcesService,
    projectId: project.id,
    workspaceService: { getDefault: async () => workspace },
  };

  expect(await syncRepoExtensionsForProjectFolder(input)).toBeNull();
  expect(await extensionService.listProjectExtensionInstances(project.id)).toEqual([]);

  workspace.initializing = false;
  const result = await syncRepoExtensionsForProjectFolder(input);
  expect(result?.enabled).toEqual(["repo-b"]);
});

test("does not import a restored tool that stays disabled during later discovery", async () => {
  const project = await projectService.create({ name: "Restored tool" });
  const repoPath = join(tempRoot, "restored");
  const extensionPath = join(repoPath, ".pstdio", "extensions", "restored-tool");
  const marker = join(tempRoot, "restored-code-ran");
  writeExtension(extensionPath, "restored-tool");
  writeFileSync(
    join(extensionPath, "extension.ts"),
    `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, "ran");\nexport default {};\n`,
  );
  const input = { extensionService, installedExtensionSourcesService, projectId: project.id, repoPath };
  await syncRepoExtensionsForProject({ ...input, enable: () => false });
  expect(existsSync(marker)).toBe(false);
  await syncRepoExtensionsForProject(input);
  expect(existsSync(marker)).toBe(false);
  const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });
  expect(instance?.enabled).toBe(false);
});

test("keeps a disabled tool's accepted metadata when its mutable manifest is removed", async () => {
  const project = await projectService.create({ name: "Accepted disabled tool" });
  const repoPath = join(tempRoot, "repo");
  const extensionPath = join(repoPath, ".pstdio", "extensions", "accepted-tool");
  writeExtension(extensionPath, "accepted-tool");
  const input = { extensionService, installedExtensionSourcesService, projectId: project.id, repoPath };
  await syncRepoExtensionsForProject(input);
  const source = await installedExtensionSourcesService.getBySourcePath(extensionPath);
  const [instance] = await extensionInstancesService.list({ scope_id: project.id, scope_type: "project" });
  await extensionService.setProjectExtensionEnabled(instance!.id, false);
  rmSync(join(extensionPath, "package.json"));
  const result = await syncRepoExtensionsForProject(input);
  expect(result).toMatchObject({ missing: [], skipped: [], enabled: [] });
  expect((await installedExtensionSourcesService.get(source!.id))?.status).toBe("loaded");
  expect((await extensionInstancesService.get(instance!.id))?.enabled).toBe(false);
});
