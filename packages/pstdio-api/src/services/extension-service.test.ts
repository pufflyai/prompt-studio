import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createExtensionService, ExtensionNameConflictError, ProjectNotFoundError } from "./extension-service";
import { createProjectService } from "./project-service";

let close: (() => Promise<void>) | undefined;
let service: ReturnType<typeof createExtensionService>;
let projectService: ReturnType<typeof createProjectService>;
let installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;

const makeExtension = (root: string, input: { name?: string; version?: string; templateKey?: string } = {}) => {
  mkdirSync(root, { recursive: true });
  const displayName = input.name ?? "Reload Extension";
  const packageName = displayName.toLowerCase().replaceAll(" ", "-");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: packageName,
      version: input.version ?? "1.0.0",
      displayName,
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
  templates: {
    ${input.templateKey ?? "ticket"}: {
      title: "Ticket",
      type: "ticket",
      source: { kind: "package-asset", path: "./ticket.md", baseUrl: import.meta.url },
    },
  },
};`,
  );
  writeFileSync(join(root, "ticket.md"), "# ticket\n");
};

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionInstancesService = createExtensionInstancesDBService(result.db);
  service = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
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
      name: "planner",
      displayName: "Planner",
      version: "1.0.0",
      sourceKind: "git",
      sourcePath: "/home/user/.pstdio/extensions/planner",
      sourceRef: "https://github.com/pufflyai/prompt-studio#main:extensions/planner",
      sourceHash: "hash-1",
      manifest: { id: "pstdio.planner", name: "planner" },
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
      name: "planner",
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
      name: "planner",
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
        name: "planner",
        displayName: "Planner",
        sourceKind: "local_path",
        sourcePath: "/extensions/planner",
        manifest: {},
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  test("throws ExtensionNameConflictError when another install owns the name", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      name: "planner",
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
        name: "planner",
        displayName: "Planner Fork",
        sourceKind: "local_path",
        sourcePath: "/extensions/planner-fork",
        manifest: {},
      }),
    ).rejects.toBeInstanceOf(ExtensionNameConflictError);
  });

  test("preserves existing source_kind and source_ref when caller omits them", async () => {
    const project = await projectService.create({ name: "Extension Project" });

    await service.enableInstalledSourceForProject({
      projectId: project.id,
      installName: "planner",
      extensionId: "pstdio.planner",
      name: "planner",
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
      name: "planner",
      displayName: "Planner",
      sourcePath: "/extensions/planner",
      manifest: {},
    });

    expect(second.installedSource.source_kind).toBe("git");
    expect(second.installedSource.source_ref).toBe("https://example/repo#main:planner");
  });

  test("reloads an installed source and records the updated manifest", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-service-reload-"));
    const eventBus = new EventBus();
    const events: { table: string; op: string; data: unknown }[] = [];
    eventBus.subscribe((event) => events.push(event));
    const reloadingService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      projectService,
      eventBus,
    });

    try {
      makeExtension(root, { templateKey: "first" });
      await reloadingService.registerInstalledSource({
        installName: "reload",
        displayName: "Reload Extension",
        extensionId: "pstdio.reload",
        manifest: { templates: ["first"] },
        name: "reload",
        sourceHash: "old-hash",
        sourceKind: "local_path",
        sourcePath: root,
        version: "1.0.0",
      });

      makeExtension(root, { name: "Reloaded Extension", version: "1.1.0", templateKey: "second" });

      const result = await reloadingService.reloadInstalledSource("reload");
      const reloadEvents = await installedExtensionSourcesService.listReloadEvents(result.installedSource.id);

      expect(result.installedSource.status).toBe("loaded");
      expect(result.installedSource.display_name).toBe("Reloaded Extension");
      expect(result.installedSource.version).toBe("1.1.0");
      expect(result.installedSource.manifest_json).toMatchObject({ templates: ["second"] });
      expect(result.installedSource.source_hash).not.toBe("old-hash");
      expect(result.installedSource.last_error_json).toBeNull();
      expect(reloadEvents.at(-1)?.status).toBe("success");
      expect(events.some((event) => event.table === "installed_extension_sources" && event.op === "set")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("marks the installed source unhealthy when reload fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-service-reload-error-"));
    const eventBus = new EventBus();
    const reloadingService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      projectService,
      eventBus,
    });

    try {
      makeExtension(root);
      const registered = await reloadingService.registerInstalledSource({
        installName: "reload",
        displayName: "Reload Extension",
        extensionId: "pstdio.reload",
        manifest: { id: "pstdio.reload", templates: ["ticket"] },
        name: "reload",
        sourceHash: "old-hash",
        sourceKind: "local_path",
        sourcePath: root,
      });

      writeFileSync(join(root, "extension.ts"), "throw new Error('reload boom');\n");

      const result = await reloadingService.reloadInstalledSource("reload");
      const reloadEvents = await installedExtensionSourcesService.listReloadEvents(registered.id);

      expect(result.installedSource.status).toBe("error");
      expect(result.installedSource.manifest_json).toEqual({ id: "pstdio.reload", templates: ["ticket"] });
      expect(result.installedSource.last_error_json).toMatchObject({ code: "extension_reload_failed" });
      expect(reloadEvents.at(-1)?.status).toBe("error");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("extensionService webview build status", () => {
  test("records webview build failures and clears them after a successful rebuild", async () => {
    const eventBus = new EventBus();
    const events: { table: string; op: string; data: unknown }[] = [];
    let refreshCount = 0;
    eventBus.subscribe((event) => events.push(event));
    const buildService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      projectService,
      eventBus,
      onInstalledSourcesChanged: () => {
        refreshCount += 1;
      },
    });

    const registered = await buildService.registerInstalledSource({
      installName: "lab",
      displayName: "Lab",
      extensionId: "pstdio.lab",
      manifest: { id: "pstdio.lab" },
      name: "lab",
      sourceHash: "hash-1",
      sourceKind: "local_path",
      sourcePath: "/extensions/lab",
    });
    refreshCount = 0;

    const failed = await buildService.reportWebviewBuildFailure("lab", "lab.labPage", new Error("build failed"));
    const reloadEvents = await installedExtensionSourcesService.listReloadEvents(registered.id);

    expect(failed.status).toBe("error");
    expect(failed.last_error_json).toMatchObject({
      code: "extension_webview_build_failed",
      message: "build failed",
      webviewId: "lab.labPage",
    });
    expect(reloadEvents.at(-1)?.error_json).toMatchObject({ webviewId: "lab.labPage" });

    const recovered = await buildService.reportWebviewBuildSuccess("lab", "lab.labPage");

    expect(recovered.status).toBe("loaded");
    expect(recovered.last_error_json).toBeNull();
    expect(refreshCount).toBe(0);
    expect(events.filter((event) => event.table === "installed_extension_sources" && event.op === "set").length).toBe(
      3,
    );
  });
});
