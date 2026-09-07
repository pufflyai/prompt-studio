import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { checkExtensionsRoot } from "pstdio-api/extensions/install-extension-source";
import { CLI_VERSION } from "@/features/cli-version";
import { findGitRoot } from "@/features/config/config";
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

describe("extensions check", () => {
  for (const scope of ["repo", "user"] as const) {
    test(`validates the ${scope} scope without errors from the other root`, async () => {
      const root = mkdtempSync(join(tmpdir(), "extension-check-scope-"));
      const repo = join(root, "repo");
      const home = join(root, "home");
      const roots = { repo: join(repo, ".pstdio", "extensions"), user: join(home, "extensions") };
      const logs: string[] = [];
      try {
        mkdirSync(repo);
        expect(Bun.spawnSync(["git", "init", "--quiet", repo]).exitCode).toBe(0);
        for (const [name, path] of Object.entries(roots)) {
          const source = join(path, "example");
          mkdirSync(source, { recursive: true });
          writeFileSync(join(source, "extension.ts"), "export default {};\n");
          writeFileSync(
            join(source, "package.json"),
            JSON.stringify({
              name: "example",
              publisher: "test",
              version: "1.0.0",
              main: "extension.ts",
              engines: { pstdio: name === scope ? EXTENSION_API_VERSION : "0.0.1" },
            }),
          );
        }
        const handler = createHandler({
          checkExtensionsRoot,
          findGitRoot,
          cwd: () => repo,
          resolvePstdioHome: () => home,
          log: (message) => logs.push(message),
        });
        await handler({ scope, json: true } as never);
        const result = JSON.parse(logs.at(-1)!);
        expect(result.checks).toHaveLength(1);
        expect(result.checks[0]).toMatchObject({ extensionsRoot: roots[scope], errorCount: 0 });
        expect(result.checks[0].extensions).toHaveLength(1);
        expect(result.versions).toMatchObject({
          cli: CLI_VERSION,
          extensionApi: EXTENSION_API_VERSION,
          dashboard: CLI_VERSION,
        });
        expect(result.versions.sdk).toMatch(/^\d+\.\d+\.\d+/);
        expect(result.checks[0].hostCompatibility).toMatchObject({
          status: "verified",
          host: { hostVersion: CLI_VERSION },
        });
        await expect(handler({ json: true } as never)).rejects.toThrow("Extension check failed");
        rmSync(roots[scope], { recursive: true, force: true });
        await handler({ scope, json: true } as never);
        expect(JSON.parse(logs.at(-1)!).checks[0].hostCompatibility.host.hostVersion).toBe(CLI_VERSION);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  test("refuses a repo scope outside a Git repository", async () => {
    const handler = createHandler({
      checkExtensionsRoot,
      findGitRoot: () => null,
      cwd: () => "/",
      resolvePstdioHome: () => "/unused",
      log: () => {},
    });
    await expect(handler({ scope: "repo" } as never)).rejects.toThrow("Git repository");
  });

  test("checks the user root and repo-local root when inside a git repo", async () => {
    const roots: string[] = [];
    const logs: string[] = [];
    const handler = createHandler({
      checkExtensionsRoot: mock(async (root: string) => {
        roots.push(root);
        return makeCheck(root);
      }),
      cwd: () => "/repo/subdir",
      findGitRoot: () => "/repo",
      log: (message) => logs.push(message),
      resolvePstdioHome: () => "/home/user/.pstdio",
    });

    await handler({ json: true } as never);

    const homeRoot = join("/home/user/.pstdio", "extensions");
    const repoRoot = join("/repo", ".pstdio", "extensions");
    expect(roots).toEqual([homeRoot, repoRoot]);
    expect(JSON.parse(logs[0] ?? "{}")).toMatchObject({
      checks: [
        {
          extensionsRoot: homeRoot,
          hostCompatibility: { status: "verified", host: { host: "dashboard" } },
        },
        {
          extensionsRoot: repoRoot,
          hostCompatibility: { status: "verified", host: { host: "dashboard" } },
        },
      ],
    });
  });

  test("fails when any checked root has errors", async () => {
    const handler = createHandler({
      checkExtensionsRoot: mock(async (root: string) =>
        makeCheck(root, root.replaceAll("\\", "/").includes("/repo/") ? 1 : 0),
      ),
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      log: () => {},
      resolvePstdioHome: () => "/home/user/.pstdio",
    });

    await expect(handler({ json: true } as never)).rejects.toThrow("Extension check failed with 1 error(s)");
  });
});
