import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
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
  routes: [],
  navigation: [],
  treeItems: [],
  settingsPanels: [],
  dataRenderers: [],
  treeRenderers: [],
  fileRenderers: [],
  keybindings: [],
  settingsDefinitions: [],
  templates: [],
  skills: [],
  diagnostics: [],
});

describe("extensions check", () => {
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

    expect(roots).toEqual(["/home/user/.pstdio/extensions", join("/repo", ".pstdio", "extensions")]);
    expect(JSON.parse(logs[0] ?? "{}")).toMatchObject({
      checks: [{ extensionsRoot: "/home/user/.pstdio/extensions" }, { extensionsRoot: "/repo/.pstdio/extensions" }],
    });
  });

  test("fails when any checked root has errors", async () => {
    const handler = createHandler({
      checkExtensionsRoot: mock(async (root: string) => makeCheck(root, root.includes("/repo/") ? 1 : 0)),
      cwd: () => "/repo",
      findGitRoot: () => "/repo",
      log: () => {},
      resolvePstdioHome: () => "/home/user/.pstdio",
    });

    await expect(handler({ json: true } as never)).rejects.toThrow("Extension check failed with 1 error(s)");
  });
});
