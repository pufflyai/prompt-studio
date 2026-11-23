import { describe, expect, mock, test } from "bun:test";
import { defaultWorkspaceProviderRuntime, runWorkspaceProviderOperation } from "./workspace-provider-runtime";

const emptyRuntime = {
  activityItems: [],
  artifactMounts: [],
  cli: [],
  commandPaletteResources: [],
  commands: [],
  diagnostics: [],
  extensions: [],
  fileIconThemes: [],
  harnesses: [],
  hooks: [],
  keybindings: [],
  middlewares: [],
  modes: [],
  pages: [],
  navigationItems: [],
  navigationTrees: [],
  placements: [],
  privateHandlers: [],
  resourceHierarchyProviders: [],
  resourceKinds: [],
  schedules: [],
  settings: [],
  settingsPanels: [],
  settingsSections: [],
  skills: [],
  statusBarItems: [],
  templateTypes: [],
  templates: [],
  themes: [],
  translations: [],
  viewMenus: [],
  views: [],
  workspaceTypes: [],
};

describe("defaultWorkspaceProviderRuntime", () => {
  test.each([
    ["example.granted", "provider-grant"],
    ["example.other", null],
  ])("limits process environment grants to the owning provider extension %s", async (extensionId, expected) => {
    const variable = "PSTDIO_TEST_PROVIDER_PROCESS_GRANT";
    const previous = {
      [variable]: process.env[variable],
      PSTDIO_EXTENSION_PROCESS_ENV: process.env.PSTDIO_EXTENSION_PROCESS_ENV,
    };
    process.env[variable] = "provider-grant";
    process.env.PSTDIO_EXTENSION_PROCESS_ENV = `example.granted:${variable}`;
    const provider = {
      id: "remote",
      ref: { kind: "workspace-type", id: "remote" },
      label: "Remote",
      create: async () => ({}),
      resolve: async () => ({}),
    };
    const deps = {
      extensionRuntimeCatalog: {
        get: async () => ({
          enabledSources: [
            {
              instance: { id: "instance-1" },
              installedSource: { id: "source-1", extension_id: extensionId, source_path: "/fake/example" },
            },
          ],
          project: { id: "project-1", name: "Example", shorthand: "EX" },
          runtime: {
            ...emptyRuntime,
            workspaceTypes: [{ id: "example.remote", extensionId, name: "remote", provider }],
          },
        }),
      },
    } as never;
    try {
      const handle = await defaultWorkspaceProviderRuntime.find(deps, {
        projectId: "project-1",
        providerId: "example.remote",
      });
      expect(handle).toBeDefined();
      const result = await runWorkspaceProviderOperation(handle!, (context) =>
        context.process.runOrThrow({
          cwd: process.cwd(),
          command: [process.execPath, "-e", `process.stdout.write(JSON.stringify(process.env.${variable} ?? null))`],
        }),
      );
      expect(JSON.parse(result.stdout)).toBe(expected);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test("builds the normal extension context for provider calls", async () => {
    const provider = {
      id: "remote",
      ref: { kind: "workspace-type", id: "remote" },
      label: "Remote",
      create: mock(async () => ({})),
      resolve: mock(async () => ({})),
    };
    const runtime = {
      ...emptyRuntime,
      workspaceTypes: [{ id: "example.remote", extensionId: "example.extension", name: "remote", provider }],
    };
    const deps = {
      extensionRuntimeCatalog: {
        get: async () => ({
          enabledSources: [
            {
              instance: { id: "instance-1" },
              installedSource: { id: "source-1", extension_id: "example.extension", source_path: "/fake/example" },
            },
          ],
          project: { id: "project-1", name: "Example", shorthand: "EX" },
          runtime,
        }),
      },
      extensionStorageService: {
        getKv: mock(async () => ({ value_json: { stored: true } })),
      },
      extensionSettingsService: {
        get: mock(async () => ({ key: "token", value: "configured" })),
      },
    } as never;

    const handle = await defaultWorkspaceProviderRuntime.find(deps, {
      projectId: "project-1",
      providerId: "example.remote",
      workspaceId: "workspace-1",
    });

    expect(handle?.provider.id).toBe("remote");
    expect((await handle?.context.storage.get("state")) as unknown).toEqual({ stored: true });
    expect(await handle?.context.settings.get("token")).toBe("configured");
  });
});

test("cancellation during context construction prevents provider callback side effects", async () => {
  const { runWorkspaceProviderOperation } = await import("./workspace-provider-runtime");
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const controller = new AbortController();
  const call = mock(() => "side effect");
  const running = runWorkspaceProviderOperation(
    {
      context: {} as never,
      provider: {} as never,
      contextForScope: async () => {
        started.resolve();
        await release.promise;
        return {} as never;
      },
    },
    call,
    { signal: controller.signal },
  );
  const settled = running.catch((error) => error);
  await started.promise;
  controller.abort();
  expect(await settled).toBeInstanceOf(Error);
  release.resolve();
  await Bun.sleep(0);
  expect(call).not.toHaveBeenCalled();
});
