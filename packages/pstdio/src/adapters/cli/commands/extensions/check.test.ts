import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { CLI_VERSION } from "@/features/cli-version";
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
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceViews: [],
  resourceHierarchyProviders: [],
  navigationItems: [],
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

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const roots: string[] = [];
  const sources: string[] = [];
  const logs: string[] = [];
  const deps = {
    checkExtensionSource: mock(async (sourcePath: string) => {
      sources.push(sourcePath);
      return { check: makeCheck(sourcePath), loaded: null };
    }),
    checkExtensionsRoot: mock(async (root: string) => {
      roots.push(root);
      return makeCheck(root);
    }),
    cwd: () => "/repo/subdir",
    findGitRoot: () => "/repo" as string | null,
    log: (message: string) => logs.push(message),
    resolvePstdioHome: () => "/home/user/.pstdio",
    ...overrides,
  };
  return { deps, roots, sources, logs };
};

describe("extensions check", () => {
  test("checks the user root and repo-local root when inside a git repo", async () => {
    const { deps, roots, logs } = makeDeps();

    await createHandler(deps)({ json: true } as never);

    expect(roots).toEqual(["/home/user/.pstdio/extensions", join("/repo", ".pstdio", "extensions")]);
    expect(JSON.parse(logs[0] ?? "{}")).toMatchObject({
      checks: [
        {
          extensionsRoot: "/home/user/.pstdio/extensions",
          hostCompatibility: { status: "verified", host: { host: "dashboard" } },
        },
        {
          extensionsRoot: "/repo/.pstdio/extensions",
          hostCompatibility: { status: "verified", host: { host: "dashboard" } },
        },
      ],
    });
  });

  test("checks only the repo-local root with --scope repo", async () => {
    const { deps, roots } = makeDeps();

    await createHandler(deps)({ json: true, scope: "repo" } as never);

    expect(roots).toEqual([join("/repo", ".pstdio", "extensions")]);
  });

  test("fails --scope repo outside a git repository", async () => {
    const { deps } = makeDeps({ findGitRoot: () => null });

    await expect(createHandler(deps)({ json: true, scope: "repo" } as never)).rejects.toThrow(
      "requires a git repository",
    );
  });

  test("checks only the user root with --scope user", async () => {
    const { deps, roots } = makeDeps();

    await createHandler(deps)({ json: true, scope: "user" } as never);

    expect(roots).toEqual(["/home/user/.pstdio/extensions"]);
  });

  test("repo errors do not fail a user-scoped check", async () => {
    const { deps } = makeDeps({
      checkExtensionsRoot: mock(async (root: string) => makeCheck(root, root.includes(".pstdio") ? 0 : 1)),
    });

    await expect(createHandler(deps)({ json: true, scope: "user" } as never)).resolves.toBeUndefined();
  });

  test("checks one extension folder when a source path is given", async () => {
    const { deps, roots, sources } = makeDeps();

    await createHandler(deps)({ json: true, source: "/repo/.pstdio/extensions/my-extension" } as never);

    expect(roots).toEqual([]);
    expect(sources).toEqual(["/repo/.pstdio/extensions/my-extension"]);
  });

  test("resolves a relative source path against the working directory", async () => {
    const { deps, sources } = makeDeps();

    await createHandler(deps)({ json: true, source: "my-extension" } as never);

    expect(sources).toEqual([join("/repo/subdir", "my-extension")]);
  });

  test("rejects a source path combined with --scope", async () => {
    const { deps } = makeDeps();

    await expect(createHandler(deps)({ json: true, source: "./x", scope: "repo" } as never)).rejects.toThrow(
      "not both",
    );
  });

  test("reports the version matrix", async () => {
    const { deps, logs } = makeDeps();

    await createHandler(deps)({ json: true } as never);

    const parsed = JSON.parse(logs[0] ?? "{}");
    expect(parsed.versions).toMatchObject({ cli: CLI_VERSION, dashboard: "0.25.2" });
    expect(typeof parsed.versions.extensionApi).toBe("string");
    expect(typeof parsed.versions.sdk).toBe("string");

    const textLogs: string[] = [];
    await createHandler({ ...deps, log: (message) => textLogs.push(message) })({} as never);
    expect(textLogs[0]).toContain(`CLI: ${CLI_VERSION}`);
    expect(textLogs[0]).toContain("Dashboard host: 0.25.2 (verified)");
  });

  test("fails when any checked root has errors", async () => {
    const { deps } = makeDeps({
      checkExtensionsRoot: mock(async (root: string) => makeCheck(root, root.includes("/repo/") ? 1 : 0)),
    });

    await expect(createHandler(deps)({ json: true } as never)).rejects.toThrow(
      "Extension check failed with 1 error(s)",
    );
  });
});
