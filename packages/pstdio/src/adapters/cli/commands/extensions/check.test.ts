import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { checkExtensions } from "pstdio-extensions";
import { createHandler } from "./check";

const sources: string[] = [];
afterAll(() => {
  for (const source of sources) rmSync(source, { recursive: true, force: true });
});

const writeSource = (range: string) => {
  const source = mkdtempSync(join(tmpdir(), "check-source-"));
  sources.push(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "tool",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: range },
    }),
  );
  writeFileSync(join(source, "extension.ts"), "export default {};\n");
  return source;
};

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
  apiUrl: () => "http://127.0.0.1:19840",
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
    const report = JSON.parse(deps.log.mock.calls[0]![0]);
    expect(report.target).toEqual({ kind: "installed", projectId: "project", host: "http://127.0.0.1:19840" });
    expect(report.checks[0]).toMatchObject({ scope: "user", extensionsRoot: "/host/extensions" });
  });
  test("names the installed target and that the versions belong to this pst", async () => {
    const deps = makeDeps();
    await createHandler(deps)({} as never);
    const output = deps.log.mock.calls[0]![0];
    expect(output).toContain("Checked: extensions installed on the host at http://127.0.0.1:19840");
    expect(output).toContain(`This pst: extension API ${EXTENSION_API_VERSION}`);
  });
  test("names the source folder and the manifest range it compared", async () => {
    const deps = makeDeps();
    const source = writeSource(`^${EXTENSION_API_VERSION}`);
    await createHandler(deps)({ source, json: true } as never);
    const report = JSON.parse(deps.log.mock.calls[0]![0]);
    expect(report.target).toEqual({ kind: "source", path: source });
    expect(report.versions).toMatchObject({
      extensionApi: EXTENSION_API_VERSION,
      manifestRange: `^${EXTENSION_API_VERSION}`,
    });
    expect(report.check.errorCount).toBe(0);
  });
  test("separates a tool version mismatch from broken extension code", async () => {
    const deps = makeDeps();
    const source = writeSource("^99.0.0");
    await expect(createHandler(deps)({ source } as never)).rejects.toThrow("error(s)");
    const output = deps.log.mock.calls[0]![0];
    expect(output).toContain(`Checked: source folder ${source}`);
    expect(output).toContain("Manifest engines.pstdio: ^99.0.0");
    expect(output).toContain(`this pst provides ${EXTENSION_API_VERSION}`);
    expect(output).not.toContain("this host");
  });
  test("reports host validation failures", async () => {
    const deps = makeDeps();
    deps.diagnostics.mockResolvedValueOnce({
      roots: [{ scope: "user", path: "/host/extensions", check: makeCheck("/host/extensions", 1) }],
    });
    await expect(createHandler(deps)({} as never)).rejects.toThrow("1 error(s)");
  });
});
