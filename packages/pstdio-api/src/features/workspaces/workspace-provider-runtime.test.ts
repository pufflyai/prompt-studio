import { describe, expect, mock, test } from "bun:test";
import { defaultWorkspaceProviderRuntime } from "./workspace-provider-runtime";

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
  placements: [],
  privateHandlers: [],
  resourceHierarchyProviders: [],
  resourceKinds: [],
  resourceViews: [],
  schedules: [],
  settings: [],
  settingsPanels: [],
  settingsSections: [],
  skills: [],
  statusBarItems: [],
  statuses: [],
  templateTypes: [],
  templates: [],
  themes: [],
  translations: [],
  viewMenus: [],
  views: [],
  workspaceTypes: [],
};

describe("defaultWorkspaceProviderRuntime", () => {
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
    expect(handle?.context.net.findFreePort).toBeFunction();
  });
});
