import { describe, expect, mock, test } from "bun:test";
import { createProjectExtensionLifecycle } from "./project-extension-lifecycle";

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
      eventBus: { emit: mock(() => {}) },
      extensionAutomationPreferencesService: { set: mock(async (row: unknown) => row) },
      extensionRuntimeCatalog: {
        get: mock(async () => ({ runtime: { schedules: [] as Array<Record<string, unknown>> } })),
        getInstalledSourceRuntime: mock(async () => ({ hooks: [], skills: input.skills ?? [] })),
      },
      extensionService: {
        getProjectExtensionInstance: mock(async () => ({ instance: extensionInstance(true), installedSource })),
        setProjectExtensionEnabled,
        uninstallProjectExtension: mock(async () => ({
          instance: extensionInstance(true),
          installedSource,
          retainedData: false,
        })),
      },
      extensionUpgradeService: {
        canUpgrade: mock(async () => false),
        installMarketplaceExtension: mock(async () => ({ instance: extensionInstance(true), installedSource })),
      },
      provisionProjectWorkspaces,
    },
    provisionProjectWorkspaces,
    setProjectExtensionEnabled,
  };
};

describe("project extension lifecycle", () => {
  test("installs without provisioning when the extension has no workspace contributions", async () => {
    const { deps, provisionProjectWorkspaces } = createDeps();
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    const result = await lifecycle.installMarketplace("project-1", "example");

    expect(result.extension).toMatchObject({ installName: "example", enabled: true });
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
    const { deps, provisionProjectWorkspaces } = createDeps({ skills: [{}] });
    provisionProjectWorkspaces.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishProvisioning = resolve;
        }),
    );
    const lifecycle = createProjectExtensionLifecycle(deps as never);

    let settled = false;
    const resultPromise = lifecycle.setEnabled("project-1", "instance-1", false).then((result) => {
      settled = true;
      return result;
    });
    for (let index = 0; index < 5 && provisionProjectWorkspaces.mock.calls.length === 0; index += 1) {
      await Promise.resolve();
    }
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
    expect(deps.eventBus.emit).toHaveBeenCalledTimes(1);
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
});
