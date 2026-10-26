import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createExtensionService } from "./extension-service";
import { createProjectService } from "./project-service";
import { createSyncService } from "./sync-service";

let close: (() => Promise<void>) | undefined;
let projectService: ReturnType<typeof createProjectService>;
let installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
let extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
let extensionUserDataService: ReturnType<typeof createExtensionUserDataDBService>;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  projectService = createProjectService({
    syncService: createSyncService({ db: result.db }),
    eventBus: new EventBus(),
    projectsDBService: createProjectsDBService(result.db),
  });
  installedExtensionSourcesService = createInstalledExtensionSourcesDBService(result.db);
  extensionInstancesService = createExtensionInstancesDBService(result.db);
  extensionUserDataService = createExtensionUserDataDBService(result.db);
});

test("does not clear a current entry failure with success from a replaced entry", async () => {
  const service = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService,
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
  });
  const sourcePath = "/extensions/lab";
  const original = entryFor(sourcePath);
  const current = { ...original, path: "./current.ts" };
  const registered = await service.registerInstalledSource({
    installName: "lab",
    displayName: "Lab",
    extensionId: "pstdio.lab",
    manifest: { views: [{ id: "page", body: { kind: "webview", entry: current } }] },
    name: "lab",
    sourceHash: "hash-1",
    sourceKind: "local_path",
    sourcePath,
  });
  await service.reportWebviewBuildFailure(registered.id, "pstdio.lab.view.page", new Error("Current entry failed"), {
    updatedAt: registered.updated_at,
    sourceHash: "hash-1",
    sourcePath,
  });
  await service.reportWebviewBuildSuccess(registered.id, "pstdio.lab.view.page", {
    updatedAt: registered.updated_at,
    sourceHash: "hash-1",
    sourcePath,
  });
  expect(await installedExtensionSourcesService.get(registered.id)).toMatchObject({
    status: "error",
    last_error_json: { message: "Current entry failed" },
    loaded_revision: null,
  });
});

afterEach(async () => {
  await close?.();
});

const entryFor = (sourcePath: string) => ({
  kind: "package-asset" as const,
  path: "./view.ts",
  baseUrl: pathToFileURL(join(sourcePath, "extension.ts")).href,
});
const manifestFor = (id: string, sourcePath: string) => ({
  id,
  views: [{ id: "page", body: { kind: "webview", entry: entryFor(sourcePath) } }],
});

const reportedSource = (
  result: Awaited<ReturnType<ReturnType<typeof createExtensionService>["reportWebviewBuildSuccess"]>>,
) => {
  expect(result.status).toBe("reported");
  if (result.status !== "reported") throw new Error("Expected a current build report");
  return result.source;
};

test.each(["success", "failure"])("ignores a late build %s after uninstall", async (outcome) => {
  let refresh = async () => {};
  const buildService = createExtensionService({
    extensionInstancesService,
    installedExtensionSourcesService,
    extensionUserDataService,
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
    onInstalledSourcesChanged: () => refresh(),
  });
  const project = await projectService.create({ name: "Removed extension" });
  const enabled = await buildService.enableInstalledSourceForProject({
    projectId: project.id,
    installName: "lab",
    displayName: "Lab",
    extensionId: "pstdio.lab",
    manifest: manifestFor("pstdio.lab", "/extensions/lab"),
    name: "lab",
    sourcePath: "/extensions/lab",
  });
  const expectedSource = {
    updatedAt: enabled.installedSource.updated_at,
    sourcePath: enabled.installedSource.source_path,
  };
  const report = async () =>
    outcome === "success"
      ? await buildService.reportWebviewBuildSuccess(enabled.installedSource.id, "pstdio.lab.view.page", expectedSource)
      : await buildService.reportWebviewBuildFailure(
          enabled.installedSource.id,
          "pstdio.lab.view.page",
          new Error("Late failure"),
          expectedSource,
        );
  refresh = async () => {
    expect((await report()).status).toBe("obsolete");
  };
  await Promise.race([
    buildService.uninstallProjectExtension({ projectId: project.id, instanceId: enabled.instance.id }),
    Bun.sleep(1000).then(() => {
      throw new Error("Uninstall refresh retained source ownership while reporting a build");
    }),
  ]);
  expect(await installedExtensionSourcesService.get(enabled.installedSource.id)).toBeNull();
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
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
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
      manifest: manifestFor("pstdio.lab", "/extensions/lab"),
      name: "lab",
      sourceHash: "hash-1",
      sourceKind: "local_path",
      sourcePath: "/extensions/lab",
    });
    refreshCount = 0;

    const failed = await buildService.reportWebviewBuildFailure(
      registered.id,
      "pstdio.lab.view.page",
      new Error("build failed"),
      {
        updatedAt: (await installedExtensionSourcesService.get(registered.id))!.updated_at,
        sourceHash: "hash-1",
        sourcePath: "/extensions/lab",
      },
    );
    const reloadEvents = await installedExtensionSourcesService.listReloadEvents(registered.id);

    expect(failed.status).toBe("reported");
    expect((await installedExtensionSourcesService.get(registered.id))?.last_error_json).toMatchObject({
      code: "extension_webview_build_failed",
      message: "build failed",
      webviewId: "pstdio.lab.view.page",
    });
    expect(reloadEvents.at(-1)?.error_json).toMatchObject({ webviewId: "pstdio.lab.view.page" });

    const recovered = reportedSource(
      await buildService.reportWebviewBuildSuccess(registered.id, "pstdio.lab.view.page", {
        updatedAt: (await installedExtensionSourcesService.get(registered.id))!.updated_at,
        sourceHash: "hash-1",
        sourcePath: "/extensions/lab",
      }),
    );

    expect(recovered.status).toBe("loaded");
    expect(recovered.last_error_json).toBeNull();
    expect(recovered.loaded_revision).toBeString();
    expect(refreshCount).toBe(0);
    expect(events.filter((event) => event.table === "installed_extension_sources" && event.op === "set").length).toBe(
      3,
    );

    const rebuilt = reportedSource(
      await buildService.reportWebviewBuildSuccess(registered.id, "pstdio.lab.view.page", {
        updatedAt: (await installedExtensionSourcesService.get(registered.id))!.updated_at,
        sourceHash: "hash-1",

        sourcePath: "/extensions/lab",
      }),
    );

    expect(rebuilt.loaded_revision).toBeString();
    expect(rebuilt.loaded_revision).not.toBe(recovered.loaded_revision);
    expect(events.filter((event) => event.table === "installed_extension_sources" && event.op === "set").length).toBe(
      4,
    );
  });

  test("ignores webview build success for an obsolete source hash", async () => {
    const eventBus = new EventBus();
    const events: { table: string; op: string; data: unknown }[] = [];
    eventBus.subscribe((event) => events.push(event));
    const buildService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      projectService,
      eventBus,
    });

    const registered = await buildService.registerInstalledSource({
      installName: "stale-lab",
      displayName: "Stale Lab",
      extensionId: "pstdio.stale-lab",
      manifest: manifestFor("pstdio.stale-lab", "/extensions/stale-lab"),
      name: "stale-lab",
      sourceHash: "hash-1",
      sourceKind: "local_path",
      sourcePath: "/extensions/stale-lab",
    });
    await installedExtensionSourcesService.updateLoadState(registered.id, { source_hash: "hash-2" });
    const eventCount = events.length;

    const ignored = await buildService.reportWebviewBuildSuccess(registered.id, "pstdio.stale-lab.view.page", {
      updatedAt: (await installedExtensionSourcesService.get(registered.id))!.updated_at,

      sourceHash: "hash-1",
      sourcePath: "/extensions/stale-lab",
    });

    expect(ignored.status).toBe("source-changed");
    expect(await installedExtensionSourcesService.get(registered.id)).toMatchObject({
      source_hash: "hash-2",
      loaded_revision: null,
    });
    expect(events).toHaveLength(eventCount);
  });

  test("ignores webview build failure for an obsolete source hash", async () => {
    const eventBus = new EventBus();
    const events: { table: string; op: string; data: unknown }[] = [];
    eventBus.subscribe((event) => events.push(event));
    const buildService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      projectService,
      eventBus,
    });

    const registered = await buildService.registerInstalledSource({
      installName: "stale-failure-lab",
      displayName: "Stale Failure Lab",
      extensionId: "pstdio.stale-failure-lab",
      manifest: manifestFor("pstdio.stale-failure-lab", "/extensions/stale-failure-lab"),
      name: "stale-failure-lab",
      sourceHash: "hash-1",
      sourceKind: "local_path",
      sourcePath: "/extensions/stale-failure-lab",
    });
    await installedExtensionSourcesService.updateLoadState(registered.id, { source_hash: "hash-2" });
    const eventCount = events.length;

    const ignored = await buildService.reportWebviewBuildFailure(
      registered.id,
      "pstdio.stale-failure-lab.view.page",
      new Error("old build failed"),
      {
        updatedAt: (await installedExtensionSourcesService.get(registered.id))!.updated_at,
        sourceHash: "hash-1",
        sourcePath: "/extensions/stale-failure-lab",
      },
    );

    expect(ignored.status).toBe("source-changed");
    expect(await installedExtensionSourcesService.get(registered.id)).toMatchObject({
      status: "loaded",
      last_error_json: null,
    });
    expect(events).toHaveLength(eventCount);
  });

  test("records build status on the built source when another source shares its install name", async () => {
    const buildService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
      projectService,
    });
    const register = (sourcePath: string) =>
      buildService.registerInstalledSource({
        installName: "font-editor",
        displayName: "Font Editor",
        extensionId: "pstdio.font-editor",
        manifest: manifestFor("pstdio.font-editor", sourcePath),
        name: "font-editor",
        sourceHash: "hash-1",
        sourceKind: "local_path",
        sourcePath,
      });
    const workspaceCopy = await register("/workspaces/WS-4/.pstdio/extensions/font-editor");
    const projectCopy = await register("/projects/app/.pstdio/extensions/font-editor");

    const failed = await buildService.reportWebviewBuildFailure(
      projectCopy.id,
      "pstdio.font-editor.view.page",
      new Error("boom"),
      {
        updatedAt: (await installedExtensionSourcesService.get(projectCopy.id))!.updated_at,
        sourceHash: "hash-1",
        sourcePath: projectCopy.source_path,
      },
    );
    const built = reportedSource(
      await buildService.reportWebviewBuildSuccess(projectCopy.id, "pstdio.font-editor.view.page", {
        updatedAt: (await installedExtensionSourcesService.get(projectCopy.id))!.updated_at,

        sourceHash: "hash-1",
        sourcePath: projectCopy.source_path,
      }),
    );

    expect(failed.status).toBe("reported");
    expect(built.id).toBe(projectCopy.id);
    expect(built.status).toBe("loaded");
    expect(built.loaded_revision).toBeString();
    expect(await installedExtensionSourcesService.get(workspaceCopy.id)).toMatchObject({
      last_error_json: null,
      loaded_revision: null,
    });
  });
});
