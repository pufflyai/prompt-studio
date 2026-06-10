import { afterEach, describe, expect, type Mock, mock, test } from "bun:test";
import { ExtensionAlreadyInstalledError } from "pstdio-api/extensions/install-extension-source";
import type { Arguments } from "yargs";
import { createHandler } from "./add";
import type { ExtensionsAddArgs } from "./shared";

const argv = (args: Partial<ExtensionsAddArgs>) =>
  ({ _: [], $0: "pstdio", source: "planner", ...args }) as Arguments<ExtensionsAddArgs>;

const installed = {
  installName: "planner",
  targetPath: "/home/user/.pstdio/extensions/planner",
  source: { kind: "named" as const, name: "planner", ref: "repo#main:extensions/planner" },
  metadata: {
    id: "pstdio.planner",
    name: "planner",
    displayName: "Planner",
    version: "1.0.0",
    enginesPstdio: "^1.0.0",
  },
  manifest: { id: "pstdio.planner" },
  sourceHash: "hash",
  check: {
    extensionsRoot: "/home/user/.pstdio/extensions",
    extensionsRootExists: true,
    errorCount: 0,
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
    views: [],
    routes: [],
    dataRenderers: [],
    treeRenderers: [],
    fileRenderers: [],
    keybindings: [],
    navigation: [],
    treeItems: [],
    settingsPanels: [],
    templates: [],
    skills: [],
    diagnostics: [],
  },
};

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(message: string) => void>;

  return {
    cwd: () => "/repo",
    enableInstalledExtension: mock(async () => ({ enabled: true, projectId: "project-1" })),
    ensureApi: mock(async () => {}),
    findGitRoot: () => "/repo",
    installDefaultSkills: mock(async () => {}),
    installExtensionSource: mock(async () => installed),
    log,
    readConfig: () => ({ project_id: "project-1" }),
    ...overrides,
  };
};

describe("extensions add", () => {
  test("installs source and enables it when run inside a linked project", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ source: "planner", name: "planner-dev", force: true, "skip-install": true }));

    expect(deps.installExtensionSource).toHaveBeenCalledWith({
      source: "planner",
      installName: "planner-dev",
      force: true,
      repoPath: "/repo",
      skipInstall: true,
    });
    expect(deps.ensureApi).toHaveBeenCalled();
    expect(deps.enableInstalledExtension).toHaveBeenCalledWith("project-1", installed);
    expect(deps.installDefaultSkills).toHaveBeenCalledWith("/repo", "project-1");

    const output = (deps.log as Mock<(message: string) => void>).mock.calls[0]?.[0] as string;
    expect(output).toContain("Id: pstdio.planner");
    expect(output).toContain("Name: planner");
    expect(output).toContain("Project: enabled for project-1");
  });

  test("skips enablement when outside a linked project", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    await handler(argv({ source: "./planner" }));

    expect(deps.installExtensionSource).toHaveBeenCalledWith({
      source: "./planner",
      installName: undefined,
      force: undefined,
      skipInstall: undefined,
    });
    expect(deps.ensureApi).not.toHaveBeenCalled();
    expect(deps.enableInstalledExtension).not.toHaveBeenCalled();
    expect(deps.installDefaultSkills).not.toHaveBeenCalled();

    const output = (deps.log as Mock<(message: string) => void>).mock.calls[0]?.[0] as string;
    expect(output).toContain("Project: not enabled");
    expect(output).toContain("Run inside a linked project");
  });

  test("prints a friendly message and sets exit code when the install target already exists", async () => {
    const deps = makeDeps({
      installExtensionSource: mock(async () => {
        throw new ExtensionAlreadyInstalledError("/home/user/.pstdio/extensions/planner");
      }),
    });
    const handler = createHandler(deps);

    await handler(argv({ source: "planner" }));

    expect(deps.ensureApi).not.toHaveBeenCalled();
    expect(deps.enableInstalledExtension).not.toHaveBeenCalled();
    expect(deps.installDefaultSkills).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    const output = (deps.log as Mock<(message: string) => void>).mock.calls[0]?.[0] as string;
    expect(output).toContain("already installed at /home/user/.pstdio/extensions/planner");
    expect(output).toContain("--force");
  });

  test("prints a clear error when a repo-scoped extension is added outside a linked project", async () => {
    const deps = makeDeps({
      findGitRoot: () => null,
      readConfig: () => null,
      installExtensionSource: mock(async () => {
        throw new Error('Extension "planner" declares pstdio.scope "repo" and must be installed from a linked repo.');
      }),
    });
    const handler = createHandler(deps);

    await expect(handler(argv({ source: "planner" }))).rejects.toThrow("must be installed from a linked repo");

    expect(deps.ensureApi).not.toHaveBeenCalled();
    expect(deps.enableInstalledExtension).not.toHaveBeenCalled();
    expect(deps.installDefaultSkills).not.toHaveBeenCalled();
  });

  // Bun does not treat `process.exitCode = undefined` as a reset (it stays at the
  // last set value), so explicitly clear it to 0 between tests to avoid leaking
  // a non-zero exit code to the bun test runner.
  afterEach(() => {
    process.exitCode = 0;
  });
});
