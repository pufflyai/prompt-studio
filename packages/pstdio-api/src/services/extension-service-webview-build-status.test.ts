import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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

afterEach(async () => {
  await close?.();
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

    const failed = await buildService.reportWebviewBuildFailure(
      registered.id,
      "lab.labPage",
      new Error("build failed"),
    );
    const reloadEvents = await installedExtensionSourcesService.listReloadEvents(registered.id);

    expect(failed.status).toBe("error");
    expect(failed.last_error_json).toMatchObject({
      code: "extension_webview_build_failed",
      message: "build failed",
      webviewId: "lab.labPage",
    });
    expect(reloadEvents.at(-1)?.error_json).toMatchObject({ webviewId: "lab.labPage" });

    const recovered = await buildService.reportWebviewBuildSuccess(registered.id, "lab.labPage");

    expect(recovered.status).toBe("loaded");
    expect(recovered.last_error_json).toBeNull();
    expect(recovered.loaded_revision).toBeString();
    expect(refreshCount).toBe(0);
    expect(events.filter((event) => event.table === "installed_extension_sources" && event.op === "set").length).toBe(
      3,
    );

    const rebuilt = await buildService.reportWebviewBuildSuccess(registered.id, "lab.labPage", {
      sourcePath: "/extensions/lab",
    });

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
      projectService,
      eventBus,
    });

    const registered = await buildService.registerInstalledSource({
      installName: "stale-lab",
      displayName: "Stale Lab",
      extensionId: "pstdio.stale-lab",
      manifest: { id: "pstdio.stale-lab" },
      name: "stale-lab",
      sourceHash: "hash-1",
      sourceKind: "local_path",
      sourcePath: "/extensions/stale-lab",
    });
    await installedExtensionSourcesService.updateLoadState(registered.id, { source_hash: "hash-2" });
    const eventCount = events.length;

    const ignored = await buildService.reportWebviewBuildSuccess(registered.id, "stale-lab.page", {
      sourceHash: "hash-1",
      sourcePath: "/extensions/stale-lab",
    });

    expect(ignored.source_hash).toBe("hash-2");
    expect(ignored.loaded_revision).toBeNull();
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
      projectService,
      eventBus,
    });

    const registered = await buildService.registerInstalledSource({
      installName: "stale-failure-lab",
      displayName: "Stale Failure Lab",
      extensionId: "pstdio.stale-failure-lab",
      manifest: { id: "pstdio.stale-failure-lab" },
      name: "stale-failure-lab",
      sourceHash: "hash-1",
      sourceKind: "local_path",
      sourcePath: "/extensions/stale-failure-lab",
    });
    await installedExtensionSourcesService.updateLoadState(registered.id, { source_hash: "hash-2" });
    const eventCount = events.length;

    const ignored = await buildService.reportWebviewBuildFailure(
      registered.id,
      "stale-failure-lab.page",
      new Error("old build failed"),
      { sourceHash: "hash-1", sourcePath: "/extensions/stale-failure-lab" },
    );

    expect(ignored.status).toBe("loaded");
    expect(ignored.last_error_json).toBeNull();
    expect(events).toHaveLength(eventCount);
  });

  test("records build status on the built source when another source shares its install name", async () => {
    const buildService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService,
      extensionUserDataService,
      projectService,
    });
    const register = (sourcePath: string) =>
      buildService.registerInstalledSource({
        installName: "font-editor",
        displayName: "Font Editor",
        extensionId: "pstdio.font-editor",
        manifest: { id: "pstdio.font-editor" },
        name: "font-editor",
        sourceHash: "hash-1",
        sourceKind: "local_path",
        sourcePath,
      });
    const workspaceCopy = await register("/workspaces/WS-4/.pstdio/extensions/font-editor");
    const projectCopy = await register("/projects/app/.pstdio/extensions/font-editor");

    const failed = await buildService.reportWebviewBuildFailure(projectCopy.id, "font-editor.page", new Error("boom"), {
      sourceHash: "hash-1",
      sourcePath: projectCopy.source_path,
    });
    const built = await buildService.reportWebviewBuildSuccess(projectCopy.id, "font-editor.page", {
      sourceHash: "hash-1",
      sourcePath: projectCopy.source_path,
    });

    expect(failed.id).toBe(projectCopy.id);
    expect(failed.status).toBe("error");
    expect(built.id).toBe(projectCopy.id);
    expect(built.status).toBe("loaded");
    expect(built.loaded_revision).toBeString();
    expect(await installedExtensionSourcesService.get(workspaceCopy.id)).toMatchObject({
      last_error_json: null,
      loaded_revision: null,
    });
  });
});
