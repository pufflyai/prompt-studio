import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionStorageDBService,
  createExtensionTemplatePreferencesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
  createReposDBService,
} from "pstdio-db";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { createRepoService } from "../../services/repo-service";
import { loadProjectExtensionRuntime } from "./extension-command-runtime";
import { syncRepoExtensionsForProject, syncRepoExtensionsForRemovedRepo } from "./repo-extensions";

let close: (() => Promise<void>) | undefined;
let tempRoot: string;

const writeExtension = (root: string, name: string, body = "export default {};", publisher = "pstdio") => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      publisher,
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(join(root, "extension.ts"), body);
};

const createDeps = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  const projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
  const repoService = createRepoService({ reposDBService: createReposDBService(result.db) });
  const extensionInstancesService = createExtensionInstancesDBService(result.db);
  const extensionSkillPreferencesService = createExtensionSkillPreferencesDBService(result.db);
  const extensionTemplatePreferencesService = createExtensionTemplatePreferencesDBService(result.db);
  const extensionService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService: createInstalledExtensionSourcesDBService(result.db),
    projectService,
  });
  return {
    extensionInstancesService,
    extensionSkillPreferencesService,
    extensionService,
    extensionStorageService: createExtensionStorageDBService(result.db),
    extensionTemplatePreferencesService,
    projectService,
    repoService,
  };
};

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-repo-extensions-"));
});

afterEach(async () => {
  rmSync(tempRoot, { recursive: true, force: true });
  await close?.();
  close = undefined;
});

describe("syncRepoExtensionsForProject", () => {
  test("registers and enables repo-local extension packages", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    writeExtension(join(tempRoot, ".pstdio", "extensions", "worktree"), "worktree");

    await syncRepoExtensionsForProject(deps, project.id);

    const [record] = await deps.extensionService.listProjectExtensionInstances(project.id);
    expect(record?.installedSource).toMatchObject({
      extension_id: "pstdio.worktree",
      source_kind: "local_path",
      status: "loaded",
    });
    expect(record?.installedSource.install_name.startsWith("local:")).toBe(true);
    expect(record?.instance.enabled).toBe(true);
  });

  test("removing a repo-local extension disables its instance and preserves storage", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    const extensionPath = join(tempRoot, ".pstdio", "extensions", "worktree");
    writeExtension(extensionPath, "worktree");
    await syncRepoExtensionsForProject(deps, project.id);
    const [first] = await deps.extensionService.listProjectExtensionInstances(project.id);
    if (!first) throw new Error("extension instance missing");

    await deps.extensionStorageService.setKv({
      extension_instance_id: first.instance.id,
      key: "setting",
      project_id: project.id,
      scope_id: project.id,
      scope_type: "project",
      value_json: { enabled: true },
    });
    await deps.extensionTemplatePreferencesService.set({
      display_name_override: "Ticket override",
      enabled: false,
      extension_instance_id: first.instance.id,
      project_id: project.id,
      template_key: "ticket",
    });
    await deps.extensionSkillPreferencesService.set({
      description_override: "Skill override",
      enabled: false,
      extension_instance_id: first.instance.id,
      project_id: project.id,
      skill_key: "review",
    });
    rmSync(extensionPath, { recursive: true, force: true });

    await syncRepoExtensionsForProject(deps, project.id);

    const [second] = await deps.extensionService.listProjectExtensionInstances(project.id);
    const stored = await deps.extensionStorageService.getKv(
      { extension_instance_id: first.instance.id, scope_id: project.id, scope_type: "project" },
      "setting",
    );
    expect(second?.instance.id).toBe(first.instance.id);
    expect(second?.instance.enabled).toBe(false);
    expect(second?.installedSource.status).toBe("uninstalled");
    expect(stored?.value_json).toEqual({ enabled: true });
    expect(await deps.extensionTemplatePreferencesService.get(project.id, first.instance.id, "ticket")).toMatchObject({
      display_name_override: "Ticket override",
      enabled: false,
    });
    expect(await deps.extensionSkillPreferencesService.get(project.id, first.instance.id, "review")).toMatchObject({
      description_override: "Skill override",
      enabled: false,
    });
  });

  test("re-adding a removed repo-local extension re-enables the original instance", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    const extensionPath = join(tempRoot, ".pstdio", "extensions", "worktree");
    writeExtension(extensionPath, "worktree");
    await syncRepoExtensionsForProject(deps, project.id);
    const [first] = await deps.extensionService.listProjectExtensionInstances(project.id);
    if (!first) throw new Error("extension instance missing");
    rmSync(extensionPath, { recursive: true, force: true });
    await syncRepoExtensionsForProject(deps, project.id);
    writeExtension(extensionPath, "worktree");

    await syncRepoExtensionsForProject(deps, project.id);

    const [second] = await deps.extensionService.listProjectExtensionInstances(project.id);
    expect(second?.instance.id).toBe(first.instance.id);
    expect(second?.instance.enabled).toBe(true);
    expect(second?.installedSource.status).toBe("loaded");
  });

  test("records package identity when the entry import fails", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    writeExtension(join(tempRoot, ".pstdio", "extensions", "broken"), "broken", "throw new Error('boom');");

    await syncRepoExtensionsForProject(deps, project.id);

    const sources = await deps.extensionService.listInstalledSourcesByInstallNamePrefix("local:");
    expect(await deps.extensionService.listProjectExtensionInstances(project.id)).toEqual([]);
    expect(sources[0]).toMatchObject({
      extension_id: "pstdio.broken",
      status: "error",
      last_error_json: { code: "extension_import_failed", message: "Extension entry failed to import: boom" },
    });
  });

  test("records invalid repo-local manifests as visible source errors", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    mkdirSync(join(tempRoot, ".pstdio", "extensions", "invalid"), { recursive: true });

    await syncRepoExtensionsForProject(deps, project.id);

    const sources = await deps.extensionService.listInstalledSourcesByInstallNamePrefix("local:");
    expect(await deps.extensionService.listProjectExtensionInstances(project.id)).toEqual([]);
    expect(sources[0]).toMatchObject({
      status: "error",
      source_kind: "local_path",
    });
    expect(sources[0]?.last_error_json).toMatchObject({ code: "extension_manifest_not_found" });
  });
});

describe("repo-local extension overrides", () => {
  test("repo-local extension replaces an enabled global source with the same identity", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    const globalPath = join(tempRoot, "global-hello");
    writeExtension(globalPath, "hello", "export default {};", "acme");
    await deps.extensionService.enableInstalledSourceForProject({
      displayName: "hello",
      extensionId: "acme.hello",
      installName: "global:hello",
      manifest: {},
      name: "hello",
      projectId: project.id,
      sourceKind: "registry",
      sourcePath: globalPath,
      version: "1.0.0",
    });
    writeExtension(join(tempRoot, ".pstdio", "extensions", "hello"), "hello", "export default {};", "acme");

    await syncRepoExtensionsForProject(deps, project.id);

    const [record] = await deps.extensionService.listEnabledSourcesForProject(project.id);
    const { runtime } = await loadProjectExtensionRuntime(
      { extensionService: deps.extensionService } as never,
      project.id,
    );
    expect(record?.installedSource).toMatchObject({ extension_id: "acme.hello", source_kind: "local_path" });
    expect(record?.installedSource.install_name).toContain(":hello");
    expect(record?.instance.diagnostics_json).toEqual({
      diagnostics: [expect.objectContaining({ code: "extension_overridden_by_local", extensionId: "acme.hello" })],
    });
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({ code: "extension_overridden_by_local", extensionId: "acme.hello" }),
    ]);
  });

  test("removing a repo-local override restores the previously enabled global source", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    const globalPath = join(tempRoot, "global-hello");
    writeExtension(globalPath, "hello", "export default {};", "acme");
    const global = await deps.extensionService.enableInstalledSourceForProject({
      displayName: "hello",
      extensionId: "acme.hello",
      installName: "global:hello",
      manifest: {},
      name: "hello",
      projectId: project.id,
      sourceKind: "registry",
      sourcePath: globalPath,
      version: "1.0.0",
    });
    const localPath = join(tempRoot, ".pstdio", "extensions", "hello");
    writeExtension(localPath, "hello", "export default {};", "acme");
    await syncRepoExtensionsForProject(deps, project.id);
    rmSync(localPath, { recursive: true, force: true });

    await syncRepoExtensionsForProject(deps, project.id);

    const [record] = await deps.extensionService.listEnabledSourcesForProject(project.id);
    const [localSource] = await deps.extensionService.listInstalledSourcesByInstallNamePrefix("local:");
    expect(record?.instance.id).toBe(global.instance.id);
    expect(record?.installedSource.id).toBe(global.installedSource.id);
    expect(record?.installedSource.source_kind).toBe("registry");
    expect(localSource?.status).toBe("uninstalled");
  });

  test("breaking a repo-local override restores the previously enabled global source", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    const globalPath = join(tempRoot, "global-hello");
    writeExtension(globalPath, "hello", "export default {};", "acme");
    const global = await deps.extensionService.enableInstalledSourceForProject({
      displayName: "hello",
      extensionId: "acme.hello",
      installName: "global:hello",
      manifest: {},
      name: "hello",
      projectId: project.id,
      sourceKind: "registry",
      sourcePath: globalPath,
      version: "1.0.0",
    });
    const localPath = join(tempRoot, ".pstdio", "extensions", "hello");
    writeExtension(localPath, "hello", "export default {};", "acme");
    await syncRepoExtensionsForProject(deps, project.id);
    rmSync(join(localPath, "extension.ts"), { force: true });

    await syncRepoExtensionsForProject(deps, project.id);

    const [record] = await deps.extensionService.listEnabledSourcesForProject(project.id);
    const [localSource] = await deps.extensionService.listInstalledSourcesByInstallNamePrefix("local:");
    expect(record?.instance.id).toBe(global.instance.id);
    expect(record?.installedSource.id).toBe(global.installedSource.id);
    expect(record?.installedSource.source_kind).toBe("registry");
    expect(localSource?.status).toBe("error");
  });

  test("disables repo-local extensions for a removed repo", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    const repo = await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    writeExtension(join(tempRoot, ".pstdio", "extensions", "worktree"), "worktree");
    await syncRepoExtensionsForProject(deps, project.id);
    const [first] = await deps.extensionService.listProjectExtensionInstances(project.id);
    if (!first) throw new Error("extension instance missing");

    await deps.repoService.removeFromProject(project.id, repo.id);
    await syncRepoExtensionsForRemovedRepo(deps, { projectId: project.id, repoPath: tempRoot });

    const [second] = await deps.extensionService.listProjectExtensionInstances(project.id);
    expect(second?.instance.id).toBe(first.instance.id);
    expect(second?.instance.enabled).toBe(false);
    expect(second?.installedSource.status).toBe("uninstalled");
  });

  test("disables an enabled repo-local extension that becomes broken", async () => {
    const deps = await createDeps();
    const project = await deps.projectService.create({ name: "Local Extensions" });
    await deps.repoService.registerForProject(project.id, { name: "repo", path: tempRoot });
    const extensionPath = join(tempRoot, ".pstdio", "extensions", "worktree");
    writeExtension(extensionPath, "worktree");
    await syncRepoExtensionsForProject(deps, project.id);
    const [first] = await deps.extensionService.listProjectExtensionInstances(project.id);
    if (!first) throw new Error("extension instance missing");

    rmSync(join(extensionPath, "extension.ts"), { force: true });
    await syncRepoExtensionsForProject(deps, project.id);

    const [second] = await deps.extensionService.listProjectExtensionInstances(project.id);
    expect(second?.instance.id).toBe(first.instance.id);
    expect(second?.instance.enabled).toBe(false);
    expect(second?.installedSource.status).toBe("error");
  });
});
