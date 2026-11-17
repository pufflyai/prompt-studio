import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { readAcceptedRevision, stopExtensionPreparation } from "pstdio-extensions";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { createSyncService } from "../../services/sync-service";
import { EventBus } from "../sync/event-bus";
import { createInstalledExtensionRuntime } from "./installed-extension-runtime";
import { syncRepoExtensionsForProject } from "./repo-extensions";
import { createRuntimeCandidateInspection } from "./runtime-candidate-inspection";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

const createFixture = async () => {
  const root = mkdtempSync(join(tmpdir(), "candidate-eligibility-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const { db, close } = await createDb({ path: ":memory:" });
  const instances = createExtensionInstancesDBService(db);
  const sources = createInstalledExtensionSourcesDBService(db);
  const eventBus = new EventBus();
  const projectService = createProjectService({
    syncService: createSyncService({ db }),
    eventBus,
    projectsDBService: createProjectsDBService(db),
  });
  const extensionService = createExtensionService({
    extensionInstancesService: instances,
    installedExtensionSourcesService: sources,
    extensionUserDataService: createExtensionUserDataDBService(db),
    eventBus,
    recovery: { exclusive: <T>(_projectId: string, run: () => Promise<T>) => run() },
    projectService,
  });
  const project = await projectService.create({ name: "Restored" });
  const otherProject = await projectService.create({ name: "Shared" });
  const sourcePath = createTestExtensionSource({
    root: join(root, "repo", ".pstdio"),
    name: "restored-candidate",
    installName: "restored-candidate",
    displayName: "Restored candidate",
  });
  const marker = join(root, "executed");
  const edit = (version: number) =>
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(marker)}, ${JSON.stringify(String(version))});\nexport default {};\n`,
    );
  edit(0);
  // Use the actual restoration/discovery policy, which registers manifest-only metadata.
  await syncRepoExtensionsForProject({
    extensionService,
    installedExtensionSourcesService: sources,
    projectId: project.id,
    repoPath: join(root, "repo"),
    enable: () => false,
  });
  const source = (await sources.getBySourcePath(sourcePath))!;
  const [instance] = await instances.list({ installed_extension_id: source.id });
  return {
    root,
    instances,
    sources,
    eventBus,
    extensionService,
    projectService,
    project,
    otherProject,
    sourcePath,
    source,
    instance: instance!,
    marker,
    edit,
    isEligible: async () =>
      (await instances.list({ installed_extension_id: source.id, scope_type: "project" })).some((row) => row.enabled),
    close: async () => {
      await stopExtensionPreparation();
      await close();
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
      rmSync(root, { recursive: true, force: true });
    },
  };
};

const fail = (error: unknown) => {
  throw error;
};

const runtimeInput = (f: Awaited<ReturnType<typeof createFixture>>) => ({
  eventBus: f.eventBus,
  extensionService: f.extensionService,
  installedExtensionSourcesService: f.sources,
  projectService: f.projectService,
  harnessRegistry: {} as never,
  workspaceService: {} as never,
  projectRuntimeCatalog: { invalidate: () => {} } as never,
  provisionWorkspacesUsingSource: async () => {},
  createRootWatcher: async () => ({ dispose: () => {}, refresh: async () => {} }),
  createSourceWatcher: async () => ({ dispose: () => {}, refresh: async () => {} }),
});

test("restored metadata stays inactive until a project enables candidate inspection", async () => {
  const f = await createFixture();
  const inspector = createRuntimeCandidateInspection({
    acceptedId: async (path) => (await readAcceptedRevision(path))?.id,
    isEligible: f.isEligible,
    onError: fail,
  });
  try {
    expect(f.source.status).toBe("loaded");
    expect(f.instance.enabled).toBe(false);
    await inspector.inspect(f.sourcePath);
    expect(existsSync(f.marker)).toBe(false);

    await f.extensionService.setProjectExtensionEnabled(f.instance.id, true);
    f.edit(1);
    await inspector.inspect(f.sourcePath);
    expect(existsSync(f.marker)).toBe(true);

    const shared = await f.instances.create({
      installed_extension_id: f.source.id,
      scope_type: "project",
      scope_id: f.otherProject.id,
      enabled: true,
    });
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, false);
    f.edit(2);
    rmSync(f.marker);
    await inspector.inspect(f.sourcePath);
    expect(existsSync(f.marker)).toBe(true);

    await f.extensionService.setProjectExtensionEnabled(shared.id, false);
    f.edit(3);
    rmSync(f.marker);
    await inspector.inspect(f.sourcePath);
    expect(existsSync(f.marker)).toBe(false);
  } finally {
    await inspector.dispose();
    await f.close();
  }
});

test("revoking the final project during identity lookup prevents candidate execution", async () => {
  const f = await createFixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const inspector = createRuntimeCandidateInspection({
    acceptedId: async () => {
      entered.resolve();
      await release.promise;
      return undefined;
    },
    isEligible: f.isEligible,
    onError: fail,
  });
  let work: Promise<void> | undefined;
  try {
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, true);
    work = inspector.inspect(f.sourcePath);
    await entered.promise;
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, false);
    release.resolve();
    await work;
    expect(existsSync(f.marker)).toBe(false);
  } finally {
    release.resolve();
    await inspector.dispose();
    await work;
    await f.close();
  }
});

test("disabling the last project retires a running candidate through real instance events", async () => {
  const f = await createFixture();
  const entered = Promise.withResolvers<void>();
  const disconnected = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      request.signal.addEventListener("abort", () => disconnected.resolve(), { once: true });
      entered.resolve();
      await release.promise;
      return new Response("continue");
    },
  });
  let changed: (path: string) => Promise<unknown> = async () => {};
  const runtime = createInstalledExtensionRuntime({
    ...runtimeInput(f),
    webviewBuilds: false,
    createSourceWatcher: async (input) => {
      changed = async (path) => {
        await input.onSourceChanged(path);
        await input.afterSourceChanged?.(path);
      };
      return { dispose: () => {}, refresh: async () => {} };
    },
  });
  try {
    await runtime.ready;
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, true);
    writeFileSync(
      join(f.sourcePath, "extension.ts"),
      `await fetch(${JSON.stringify(gate.url.href)});\nimport { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(f.marker)}, "resumed");\nexport default {};\n`,
    );
    await changed(f.sourcePath);
    await entered.promise;
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, false);
    expect(
      await Promise.race([disconnected.promise.then(() => "retired"), Bun.sleep(1000).then(() => "still running")]),
    ).toBe("retired");
    release.resolve();
    await runtime.refresh();
    expect(existsSync(f.marker)).toBe(false);
  } finally {
    release.resolve();
    await runtime.dispose();
    await gate.stop(true);
    await f.close();
  }
});

test("default webview preparation leaves restored sources inactive until enabled", async () => {
  const f = await createFixture();
  const runtime = createInstalledExtensionRuntime({
    ...runtimeInput(f),
    webviewBuilds: true,
  });
  try {
    await runtime.ready;
    await runtime.ensureWebviews(f.source.id);
    expect(existsSync(f.marker)).toBe(false);
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, true);
    await runtime.refresh(f.sourcePath);
    await runtime.ensureWebviews(f.source.id);
    expect(existsSync(f.marker)).toBe(true);
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, false);
    f.edit(1);
    rmSync(f.marker);
    await runtime.refresh(f.sourcePath);
    await runtime.ensureWebviews(f.source.id);
    expect(existsSync(f.marker)).toBe(false);
  } finally {
    await runtime.dispose();
    await f.close();
  }
});

test("last-project disable retires executable webview inspection without discarding metadata", async () => {
  const f = await createFixture();
  const entered = Promise.withResolvers<void>();
  const disconnected = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      request.signal.addEventListener("abort", () => disconnected.resolve(), { once: true });
      entered.resolve();
      await release.promise;
      return new Response("continue");
    },
  });
  await f.extensionService.setProjectExtensionEnabled(f.instance.id, true);
  writeFileSync(
    join(f.sourcePath, "extension.ts"),
    `await fetch(${JSON.stringify(gate.url.href)});\nimport { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(f.marker)}, "resumed");\nexport default {};\n`,
  );
  const runtime = createInstalledExtensionRuntime({ ...runtimeInput(f), webviewBuilds: true });
  let work: Promise<unknown> | undefined;
  try {
    await runtime.ready;
    work = runtime.ensureWebviews(f.source.id);
    await entered.promise;
    await f.extensionService.setProjectExtensionEnabled(f.instance.id, false);
    expect(
      await Promise.race([disconnected.promise.then(() => "retired"), Bun.sleep(1000).then(() => "still running")]),
    ).toBe("retired");
    release.resolve();
    await work;
    expect(existsSync(f.marker)).toBe(false);
    expect((await f.sources.get(f.source.id))?.status).toBe("loaded");
  } finally {
    release.resolve();
    await runtime.dispose();
    await work;
    await gate.stop(true);
    await f.close();
  }
});
