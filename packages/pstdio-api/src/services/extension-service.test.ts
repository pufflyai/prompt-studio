import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService, NamespaceConflictError, ProjectNotFoundError } from "./extension-service";
import { createProjectService } from "./project-service";

let close: (() => Promise<void>) | undefined;
let service: ReturnType<typeof createExtensionService>;
let projectService: ReturnType<typeof createProjectService>;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
  service = createExtensionService({
    extensionInstancesService: createExtensionInstancesDBService(result.db),
    installedExtensionSourcesService: createInstalledExtensionSourcesDBService(result.db),
    projectService,
  });
});

afterEach(async () => {
  await close?.();
});

describe("extensionService", () => {
  test("registers an installed source and enables it for a project", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const result = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      version: "1.0.0",
      sourceKind: "git",
      sourcePath: "/home/user/.pstdio/extensions/planner",
      sourceRef: "https://github.com/pufflyai/prompt-studio#main:extensions/planner",
      sourceHash: "hash-1",
      manifest: { id: "pstdio.planner", namespace: "planner" },
    });

    expect(result.installedSource.install_name).toBe("planner");
    expect(result.installedSource.status).toBe("loaded");
    expect(result.instance.scope_type).toBe("project");
    expect(result.instance.scope_id).toBe(project.id);
    expect(result.instance.enabled).toBe(true);
  });

  test("updates an existing install record and re-enables the same project instance", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    const first = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      sourceKind: "local_path",
      sourcePath: "/one",
      sourceHash: "hash-1",
      manifest: {},
    });
    await service.setProjectExtensionEnabled(first.instance.id, false);

    const second = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      version: "2.0.0",
      sourceKind: "local_path",
      sourcePath: "/two",
      sourceHash: "hash-2",
      manifest: { version: "2.0.0" },
    });

    expect(second.installedSource.id).toBe(first.installedSource.id);
    expect(second.installedSource.source_path).toBe("/two");
    expect(second.installedSource.version).toBe("2.0.0");
    expect(second.instance.id).toBe(first.instance.id);
    expect(second.instance.enabled).toBe(true);
  });

  test("fails with ProjectNotFoundError when the project does not exist", async () => {
    await expect(
      service.enableInstalledSourceForProject({
        projectId: "missing",
        installName: "planner",
        extensionId: "pstdio.planner",
        namespace: "planner",
        displayName: "Planner",
        sourceKind: "local_path",
        sourcePath: "/extensions/planner",
        manifest: {},
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  test("throws NamespaceConflictError when another install owns the namespace", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      sourceKind: "local_path",
      sourcePath: "/extensions/planner",
      manifest: {},
    });

    await expect(
      service.enableInstalledSourceForProject({
        projectId: project.id,
        installName: "planner-fork",
        extensionId: "pstdio.planner-fork",
        namespace: "planner",
        displayName: "Planner Fork",
        sourceKind: "local_path",
        sourcePath: "/extensions/planner-fork",
        manifest: {},
      }),
    ).rejects.toBeInstanceOf(NamespaceConflictError);
  });

  test("preserves existing source_kind and source_ref when caller omits them", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      sourceKind: "git",
      sourcePath: "/extensions/planner",
      sourceRef: "https://example/repo#main:planner",
      manifest: {},
    });

    const second = await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      namespace: "planner",
      displayName: "Planner",
      sourcePath: "/extensions/planner",
      manifest: {},
    });

    expect(second.installedSource.source_kind).toBe("git");
    expect(second.installedSource.source_ref).toBe("https://example/repo#main:planner");
  });
});
