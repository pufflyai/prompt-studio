import { describe, expect, mock, test } from "bun:test";
import { checkExtensions } from "pstdio-extensions";
import { createHandler } from "./check";

const makeCheck = (extensionsRoot: string, errorCount = 0) => ({
  extensionsRoot,
  extensionsRootExists: true,
  errorCount,
  warningCount: 0,
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  schedules: [],
  artifactMounts: [],
  commandPaletteContributions: [],
  commandPaletteResources: [],
  themes: [],
  fileIconThemes: [],
  menuContributions: [],
  modes: [],
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceHierarchyProviders: [],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  statuses: [],
  activityItems: [],
  settingsSections: [],
  settingsPanels: [],
  keybindings: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics: [],
  hostCompatibility: {
    status: "verified" as const,
    host: { host: "dashboard" as const, hostVersion: "0.25.2", capabilities: {} },
    diagnostics: [],
  },
});

const makeDeps = () => ({
  cwd: () => "/client/project",
  findProjectRoot: () => "/client/project",
  readConfig: () => ({ project_id: "project" }),
  ensureApi: async () => undefined,
  diagnostics: mock(async () => ({
    roots: [{ scope: "user" as const, path: "/host/extensions", check: makeCheck("/host/extensions") }],
  })),
  checkLocal: checkExtensions,
  log: mock((_message: string) => {}),
});
describe("extensions check", () => {
  test("checks installed roots on the host", async () => {
    const deps = makeDeps();
    await createHandler(deps)({ scope: "user", json: true } as never);
    expect(deps.diagnostics).toHaveBeenCalledWith("project", { scope: "user" });
    expect(JSON.parse(deps.log.mock.calls[0]![0]).checks[0].extensionsRoot).toBe("/host/extensions");
  });
  test("reports host validation failures", async () => {
    const deps = makeDeps();
    deps.diagnostics.mockResolvedValueOnce({
      roots: [{ scope: "user", path: "/host/extensions", check: makeCheck("/host/extensions", 1) }],
    });
    await expect(createHandler(deps)({} as never)).rejects.toThrow("1 error(s)");
  });
});
