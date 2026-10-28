import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallations } from "../../services/extension-installations";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestDocumentStorage } from "../../test-utils/create-test-document-storage";
import { loadExtensionSource } from "./extension-runtime";
import { createProjectExtensionLifecycle } from "./project-extension-lifecycle";
import { openPublishedCatalog, publishExtension } from "./publication/catalog";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

const installedSource = {
  id: "source-1",
  install_name: "example",
  extension_id: "test.example",
  display_name: "Example",
  source_path: "/extensions/example",
  source_kind: "local_path",
  source_ref: null,
  version: "1.0.0",
  manifest_json: { name: "example" },
  source_hash: "hash-1",
  status: "loaded" as const,
  last_loaded_at: null,
  last_error_json: null,
};

const extensionInstance = (enabled: boolean) => ({
  id: "instance-1",
  installed_extension_id: installedSource.id,
  scope_type: "project" as const,
  scope_id: "project-1",
  display_name_override: null,
  enabled,
  config_json: {},
});

const createDeps = (input: { skills?: unknown[] } = {}) => {
  const setProjectExtensionEnabled = mock(async (_instanceId: string, enabled: boolean) => extensionInstance(enabled));
  const provisionProjectWorkspaces = mock(async () => {});
  return {
    deps: {
      extensionInstallations: createExtensionInstallations(),
      eventBus: { emit: mock(() => {}) },
      extensionAutomationPreferencesService: { set: mock(async (row: unknown) => row) },
      extensionConnectionService: { removeExtension: mock(async () => {}) },
      extensionStorageService: createTestDocumentStorage(),
      extensionRuntimeCatalog: {
        get: mock(async () => ({ runtime: { schedules: [] as Array<Record<string, unknown>> } })),
        getSourcesRuntime: mock(async () => ({ hooks: [], skills: input.skills ?? [] })),
      },
      extensionService: {
        enableInstalledSourceForProject: async () => ({ instance: extensionInstance(true), installedSource }),
        getProjectExtensionInstance: mock(async () => ({ instance: extensionInstance(true), installedSource })),
        listProjectExtensionInstances: mock(async () => []),
        setProjectExtensionEnabled,
        uninstallProjectExtension: mock(async () => ({
          instance: extensionInstance(true),
          installedSource,
          retainedData: false,
        })),
      },
      extensionUpgradeService: {
        canUpgrade: mock(async () => false),
        installSource: mock(async () => ({
          installName: "test",
          metadata: { id: "test", name: "test" },
          manifest: {},
          targetPath: "/test",
          source: { kind: "local" },
        })),
      },
      provisionProjectWorkspaces,
      workspaceService: {
        listForProviderReconciliation: mock(async (): Promise<Array<{ id: string; provider_id: string }>> => []),
      },
    },
    provisionProjectWorkspaces,
    setProjectExtensionEnabled,
  };
};

describe("project extension lifecycle", () => {
  test("releases the installation slot before workspace hooks acquire harness packages", async () => {
    const { deps, provisionProjectWorkspaces } = createDeps({ skills: [{}] });
    provisionProjectWorkspaces.mockImplementation(async () => {
      expect(deps.extensionInstallations.list()[0]?.status).toBe("completed");
      await deps.extensionInstallations.run({ installName: "example", displayName: "Example" }, async () => {});
    });
    await createProjectExtensionLifecycle(deps as never).install("project-1", {
      source: { kind: "catalog", name: "example" },
    });
    expect(provisionProjectWorkspaces).toHaveBeenCalledTimes(1);
    expect(deps.extensionInstallations.list().map((job) => job.status)).toEqual(["completed", "completed"]);
  });
  test("installs without provisioning when the extension has no workspace contributions", async () => {
    const { deps, provisionProjectWorkspaces } = createDeps();
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    const result = await lifecycle.install("project-1", { source: { kind: "catalog", name: "example" } });

    expect(result.extension).toMatchObject({ installName: "example", enabled: true });
    expect(deps.extensionInstallations.list()).toMatchObject([
      { projectId: "project-1", installName: "example", status: "completed" },
    ]);
    expect(provisionProjectWorkspaces).not.toHaveBeenCalled();
  });

  test("does not provision workspaces when enablement cannot change workspace files", async () => {
    const { deps, provisionProjectWorkspaces } = createDeps();
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    const result = await lifecycle.setEnabled("project-1", "instance-1", false);

    expect(result).toMatchObject({ id: "instance-1", enabled: false });
    expect(provisionProjectWorkspaces).not.toHaveBeenCalled();
  });

  test("finishes required workspace provisioning before enablement returns", async () => {
    let finishProvisioning: (() => void) | undefined;
    let startedProvisioning: (() => void) | undefined;
    const provisioningStarted = new Promise<void>((resolve) => {
      startedProvisioning = resolve;
    });
    const { deps, provisionProjectWorkspaces } = createDeps({ skills: [{}] });
    provisionProjectWorkspaces.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishProvisioning = resolve;
          startedProvisioning?.();
        }),
    );
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    let settled = false;
    const resultPromise = lifecycle.setEnabled("project-1", "instance-1", false).then((result) => {
      settled = true;
      return result;
    });
    await provisioningStarted;
    expect(provisionProjectWorkspaces).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    finishProvisioning?.();
    await expect(resultPromise).resolves.toMatchObject({ enabled: false });
  });

  test("returns the committed automation preference", async () => {
    const { deps } = createDeps();
    deps.extensionRuntimeCatalog.get.mockResolvedValue({
      runtime: {
        schedules: [
          {
            id: "test.example.schedule.refine",
            localId: "refine",
            extensionId: "test.example",
            title: "Refine",
            cron: "0 * * * *",
            commandId: "test.example.command.refine",
          },
        ],
      },
    });
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    const result = await lifecycle.setAutomationEnabled(
      "project-1",
      "instance-1",
      "test.example.schedule.refine",
      false,
    );

    expect(result).toMatchObject({
      id: "test.example.schedule.refine",
      extensionInstanceId: "instance-1",
      enabled: false,
    });
    expect(deps.extensionAutomationPreferencesService.set).toHaveBeenCalledTimes(1);
  });

  test("reports whether uninstall retained user data", async () => {
    const { deps } = createDeps();
    deps.extensionService.uninstallProjectExtension.mockResolvedValue({
      instance: extensionInstance(false),
      installedSource,
      retainedData: true,
    });
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    const result = await lifecycle.uninstall({
      projectId: "project-1",
      instanceId: "instance-1",
      deleteUserData: false,
    });

    expect(result).toBe("retained-disabled");
  });

  test("blocks uninstall while the extension owns provider-backed workspaces", async () => {
    const { deps } = createDeps();
    deps.workspaceService.listForProviderReconciliation.mockResolvedValue([
      { id: "workspace-1", provider_id: "test.example.workspace-type.remote" },
    ]);
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    await expect(
      lifecycle.uninstall({ projectId: "project-1", instanceId: "instance-1", deleteUserData: true }),
    ).rejects.toThrow("provider-backed workspace");
    expect(deps.extensionConnectionService.removeExtension).not.toHaveBeenCalled();
    expect(deps.extensionService.uninstallProjectExtension).not.toHaveBeenCalled();
  });

  test("keeps connection credentials when extension uninstall fails", async () => {
    const { deps } = createDeps();
    deps.extensionService.uninstallProjectExtension.mockRejectedValue(new Error("extension uninstall failed"));
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    await expect(
      lifecycle.uninstall({ projectId: "project-1", instanceId: "instance-1", deleteUserData: true }),
    ).rejects.toThrow("extension uninstall failed");
    expect(deps.extensionConnectionService.removeExtension).not.toHaveBeenCalled();
  });

  test("removes named connection credentials after extension uninstall commits", async () => {
    const { deps } = createDeps();
    const order: string[] = [];
    deps.extensionConnectionService.removeExtension.mockImplementation(async () => {
      order.push("connections");
    });
    deps.extensionService.uninstallProjectExtension.mockImplementation(async () => {
      order.push("extension");
      return { instance: extensionInstance(true), installedSource, retainedData: false };
    });
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    await lifecycle.uninstall({ projectId: "project-1", instanceId: "instance-1", deleteUserData: true });

    expect(order).toEqual(["extension", "connections"]);
  });

  test("keeps a committed extension uninstall successful when connection cleanup must retry", async () => {
    const { deps } = createDeps();
    deps.extensionConnectionService.removeExtension.mockRejectedValue(new Error("connection cleanup failed"));
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    await expect(
      lifecycle.uninstall({ projectId: "project-1", instanceId: "instance-1", deleteUserData: true }),
    ).resolves.toBe("removed");
  });
});

describe("published extension lifecycle", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "published-lifecycle-"));
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  const install = async (projectId: string, installName: string, name: string, extensionTs?: string) => {
    const sourcePath = createTestExtensionSource({ root, installName, name, displayName: name });
    if (extensionTs) await writeFile(join(sourcePath, "extension.ts"), extensionTs);
    const loaded = await loadExtensionSource(sourcePath);
    const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId,
      sourcePath,
      extensionId: loaded.metadata.id,
      installName,
      name,
      displayName: name,
      manifest: loaded.manifest,
    });
    return instance.id;
  };
  const publish = async (projectId: string, instanceId: string, extensionId: string) =>
    publishExtension(app.deps, {
      projectId,
      instanceId,
      expectedRevision: (await (await openPublishedCatalog(app.deps, projectId)).read(extensionId)).revision,
    });
  const selection = async (projectId: string, extensionId: string) =>
    (await openPublishedCatalog(app.deps, projectId)).records.read(extensionId);

  test("an enable this device refuses is not shared", async () => {
    const project = await app.deps.projectService.create({ name: "Refused enable" });
    const lifecycle = createProjectExtensionLifecycle(app.deps);
    const prefixed =
      'export default { resourceKinds: [{ id: "item", ref: { kind: "resource-kind", id: "item" }, prefix: "XX" }] };';
    const published = await install(project.id, "prefix-published", "prefix-published", prefixed);
    await lifecycle.setEnabled(project.id, published, false);
    await publish(project.id, published, "test.prefix-published");
    await install(project.id, "prefix-local", "prefix-local", prefixed);

    await expect(lifecycle.setEnabled(project.id, published, true)).rejects.toThrow("prefix");
    expect((await selection(project.id, "test.prefix-published")).value).toMatchObject({ enabled: false });
  });

  test("uninstalling a leftover copy keeps the published extension on every device", async () => {
    const project = await app.deps.projectService.create({ name: "Leftover copy" });
    const lifecycle = createProjectExtensionLifecycle(app.deps);
    const leftover = await install(project.id, "copy-old", "copy");
    const active = await install(project.id, "copy-new", "copy");
    await publish(project.id, active, "test.copy");

    await lifecycle.uninstall({ projectId: project.id, instanceId: leftover, deleteUserData: true });
    expect((await selection(project.id, "test.copy")).deleted).toBe(false);
    await lifecycle.uninstall({ projectId: project.id, instanceId: active, deleteUserData: true });
    expect((await selection(project.id, "test.copy")).deleted).toBe(true);
  });

  test("disabling a leftover copy keeps the published extension enabled on every device", async () => {
    const project = await app.deps.projectService.create({ name: "Leftover disable" });
    const lifecycle = createProjectExtensionLifecycle(app.deps);
    const leftover = await install(project.id, "spare-old", "spare");
    const active = await install(project.id, "spare-new", "spare");
    await publish(project.id, active, "test.spare");

    await lifecycle.setEnabled(project.id, leftover, false);
    expect((await selection(project.id, "test.spare")).value).toMatchObject({ enabled: true });
    await lifecycle.setEnabled(project.id, active, false);
    expect((await selection(project.id, "test.spare")).value).toMatchObject({ enabled: false });
  });

  const failingUninstall = (beforeFailure: () => Promise<void> = async () => {}) =>
    createProjectExtensionLifecycle({
      ...app.deps,
      extensionService: {
        ...app.deps.extensionService,
        uninstallProjectExtension: async () => {
          await beforeFailure();
          throw new Error("source folder is busy");
        },
      },
    });

  test("a failed uninstall keeps the published extension on every device", async () => {
    const project = await app.deps.projectService.create({ name: "Failed uninstall" });
    const instanceId = await install(project.id, "busy", "busy");
    await publish(project.id, instanceId, "test.busy");
    const published = await selection(project.id, "test.busy");

    await expect(
      failingUninstall().uninstall({ projectId: project.id, instanceId, deleteUserData: true }),
    ).rejects.toThrow("source folder is busy");
    expect(await selection(project.id, "test.busy")).toMatchObject({ deleted: false, value: published.value });
  });

  test("a failed uninstall reports its own error when restoring the shared selection fails", async () => {
    const project = await app.deps.projectService.create({ name: "Failed uninstall and restore" });
    const instanceId = await install(project.id, "gone", "gone");
    await publish(project.id, instanceId, "test.gone");
    // The project disappears while the uninstall runs, so the shared selection cannot be written back.
    const lifecycle = failingUninstall(async () => {
      await app.deps.projectService.delete(project.id);
    });

    await expect(lifecycle.uninstall({ projectId: project.id, instanceId, deleteUserData: true })).rejects.toThrow(
      "source folder is busy",
    );
  });

  test("a failed uninstall keeps a newer shared choice", async () => {
    const project = await app.deps.projectService.create({ name: "Failed uninstall newer choice" });
    const instanceId = await install(project.id, "raced", "raced");
    await publish(project.id, instanceId, "test.raced");
    const published = await selection(project.id, "test.raced");
    const newer = { ...(published.value as { revision: string }), enabled: false };
    // Another device restores the extension with its own choice while this uninstall runs.
    const lifecycle = failingUninstall(async () => {
      await (await openPublishedCatalog(app.deps, project.id)).records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: "test.raced", replace: newer, deleted: false }],
      });
    });

    await expect(lifecycle.uninstall({ projectId: project.id, instanceId, deleteUserData: true })).rejects.toThrow(
      "source folder is busy",
    );
    expect(await selection(project.id, "test.raced")).toMatchObject({ deleted: false, value: newer });
  });
});
