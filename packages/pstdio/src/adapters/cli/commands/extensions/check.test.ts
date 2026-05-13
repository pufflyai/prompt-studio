import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Arguments } from "yargs";
import { createHandler } from "./check";
import type { ExtensionsCheckArgs } from "./shared";

const argv = (args: Partial<ExtensionsCheckArgs> = {}) =>
  ({ _: [], $0: "pstdio", json: false, ...args }) as Arguments<ExtensionsCheckArgs>;

const emptyCheck = (root: string) => ({
  extensionsRoot: root,
  extensionsRootExists: true,
  errorCount: 0,
  warningCount: 0,
  extensions: [],
  commands: [],
  middlewares: [],
  hooks: [],
  schedules: [],
  artifactMounts: [],
  themes: [],
  fileIconThemes: [],
  menuContributions: [],
  views: [],
  routes: [],
  navigation: [],
  settingsPanels: [],
  templates: [],
  skills: [],
  diagnostics: [],
});

const cwd = process.cwd();

afterEach(() => {
  process.chdir(cwd);
  process.exitCode = 0;
});

describe("extensions check", () => {
  test("checks global and repo-local extension roots when run inside a git repo", async () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), "pstdio-extensions-check-")));
    mkdirSync(join(repo, ".git"));
    process.chdir(repo);
    const checkExtensionsRoots = mock(async (roots: string[]) => emptyCheck(roots[0] ?? ""));
    const log = mock(() => {});

    try {
      await createHandler({
        checkExtensionsRoot: mock(async (root: string) => emptyCheck(root)),
        checkExtensionsRoots,
        log,
        resolvePstdioHome: () => "/home/user/.pstdio",
      })(argv({ json: true }));

      expect(checkExtensionsRoots).toHaveBeenCalledWith([
        "/home/user/.pstdio/extensions",
        join(repo, ".pstdio", "extensions"),
      ]);
      expect(log).toHaveBeenCalled();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
