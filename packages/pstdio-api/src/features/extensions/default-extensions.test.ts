import { describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installDefaultExtensions,
  installRepoDefaultExtensions,
  resolveDefaultExtensionsConfig,
  syncInstalledExtensionsForProject,
  syncInstalledExtensionsForProjects,
} from "./default-extensions";

const installed = {
  installName: "pstdio-core-skills",
  targetPath: "/home/user/.pstdio/extensions/pstdio-core-skills",
  source: { kind: "named" as const, name: "pstdio-core-skills", ref: "repo#main:extensions/pstdio-core-skills" },
  metadata: {
    id: "pstdio.pstdio-core-skills",
    name: "pstdio-core-skills",
    displayName: "Core Skills",
    version: "0.1.0",
    enginesPstdio: "^1.0.0",
  },
  manifest: { id: "pstdio.pstdio-core-skills" },
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
    templates: [],
    skills: [],
    diagnostics: [],
  },
};

const writeExtension = (dir: string, namespace: string, scope?: "repo" | "user") => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: namespace,
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      ...(scope ? { pstdio: { scope } } : {}),
    }),
  );
  writeFileSync(join(dir, "extension.ts"), `export default {};`);
};

const writeInvalidExtension = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
  broken: true,
};`,
  );
};

describe("resolveDefaultExtensionsConfig", () => {
  test("returns the production defaults when the env override is absent", () => {
    const config = resolveDefaultExtensionsConfig({});

    expect(config.defaultExtensions).toEqual([
      "pstdio-core-skills",
      "pstdio-core-templates",
      "pstdio-core-tickets",
      "pstdio-core-workspace-automations",
      "pstdio-core-worktree-automations",
    ]);
  });

  test("uses PSTDIO_DEFAULT_EXTENSIONS JSON when set", () => {
    const config = resolveDefaultExtensionsConfig({
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
        { source: "./extensions/pstdio-core-skills", installName: "core-skills-dev", skipInstall: true },
      ]),
    });

    expect(config.defaultExtensions).toEqual([
      { source: "./extensions/pstdio-core-skills", installName: "core-skills-dev", skipInstall: true },
    ]);
  });
});

describe("installDefaultExtensions", () => {
  test("uses local source packages for production defaults when running from source", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return installed;
    });
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource: mock(), cleanup: mock() }));

    await installDefaultExtensions({
      env: {},
      installExtensionSource,
      prepareSharedCheckout,
    });

    expect(prepareSharedCheckout).not.toHaveBeenCalled();
    expect(calls.map((call) => call.installName)).toEqual([
      "pstdio-core-skills",
      "pstdio-core-templates",
      "pstdio-core-tickets",
      "pstdio-core-workspace-automations",
    ]);
    expect(
      calls.every((call) => typeof call.source === "string" && (call.source as string).includes("/extensions/")),
    ).toBe(true);
    expect(calls.every((call) => call.skipInstall === undefined)).toBe(true);
    expect(calls.every((call) => call.force === true)).toBe(true);
  });

  test("passes existsOk=true and reuses one shared checkout for all named entries", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-shared-"));
    writeExtension(join(root, "pstdio-core-skills"), "pstdio-core-skills");
    writeExtension(join(root, "pstdio-core-templates"), "pstdio-core-templates");
    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return installed;
    });
    const prepareNamedSource = mock(async (name: string) => ({ path: join(root, name), ref: "ref" }));
    const cleanup = mock();
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource, cleanup }));

    try {
      await installDefaultExtensions({
        config: { defaultExtensions: ["pstdio-core-skills", "pstdio-core-templates"] },
        installExtensionSource,
        prepareSharedCheckout,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(prepareSharedCheckout).toHaveBeenCalledTimes(1);
    expect(prepareSharedCheckout).toHaveBeenCalledWith(["pstdio-core-skills", "pstdio-core-templates"]);
    expect(installExtensionSource).toHaveBeenCalledTimes(2);
    expect(calls[0]?.existsOk).toBe(true);
    expect(calls[0]?.prepareNamedSource).toBe(prepareNamedSource);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("skips the shared checkout when all entries are local paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-local-"));
    const source = join(root, "pstdio-core-skills");
    writeExtension(source, "pstdio-core-skills");
    const installExtensionSource = mock(async () => installed);
    const prepareSharedCheckout = mock(async () => ({ prepareNamedSource: mock(), cleanup: mock() }));

    try {
      await installDefaultExtensions({
        config: { defaultExtensions: [{ source }] },
        installExtensionSource,
        prepareSharedCheckout,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(prepareSharedCheckout).not.toHaveBeenCalled();
    expect(installExtensionSource).toHaveBeenCalledTimes(1);
  });

  test("continues after a default extension install fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-best-effort-"));
    const broken = join(root, "broken-extension");
    const healthy = join(root, "healthy-extension");
    writeExtension(broken, "broken-extension");
    writeExtension(healthy, "healthy-extension");
    const failures: Array<{ installName: string; message: string; source: string }> = [];
    const installExtensionSource = mock(async (input: { installName?: string; source: string }) => {
      if (input.installName === "broken") throw new Error("Cannot find module '@pstdio/sdk/extensions'");
      return { ...installed, installName: input.installName ?? "healthy" };
    });

    try {
      const result = await installDefaultExtensions({
        config: {
          defaultExtensions: [
            { source: broken, installName: "broken", skipInstall: true },
            { source: healthy, installName: "healthy", skipInstall: true },
          ],
        },
        installExtensionSource,
        onInstallFailure: ({ error, installName, source }) => {
          failures.push({ installName, message: error instanceof Error ? error.message : String(error), source });
        },
      });

      expect(result.map((entry) => entry.installName)).toEqual(["healthy"]);
      expect(failures).toEqual([
        {
          installName: "broken",
          message: "Cannot find module '@pstdio/sdk/extensions'",
          source: broken,
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installRepoDefaultExtensions", () => {
  test("materializes only repo-scoped defaults without overwriting existing folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-repo-defaults-"));
    const source = join(root, "source-extension");
    const userSource = join(root, "user-extension");
    const repo = join(root, "repo");
    writeExtension(source, "source-extension", "repo");
    writeExtension(userSource, "user-extension", "user");

    try {
      const first = await installRepoDefaultExtensions({
        repoPath: repo,
        defaultExtensions: [
          { source, installName: "source-extension", skipInstall: true },
          { source: userSource, installName: "user-extension", skipInstall: true },
        ],
      });
      writeFileSync(join(repo, ".pstdio", "extensions", "source-extension", "custom.txt"), "custom");
      const second = await installRepoDefaultExtensions({
        repoPath: repo,
        defaultExtensions: [{ source, installName: "source-extension", skipInstall: true }],
      });

      expect(first).toEqual({ materialized: ["source-extension"], skipped: [] });
      expect(second).toEqual({ materialized: [], skipped: ["source-extension"] });
      expect(existsSync(join(repo, ".pstdio", "extensions", "user-extension", "extension.ts"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("syncInstalledExtensionsForProject", () => {
  test("syncs every installed extension found on disk for the project", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-"));
    writeExtension(join(root, "core-templates"), "core-templates");
    writeExtension(join(root, "core-skills"), "core-skills");
    const calls: Array<Record<string, unknown>> = [];
    const syncInstalledSourceForProject = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return {};
    });

    try {
      const synced = await syncInstalledExtensionsForProject({
        extensionService: { syncInstalledSourceForProject },
        extensionsRoot: root,
        projectId: "project-1",
      });

      expect(synced).toEqual(["core-skills", "core-templates"]);
      expect(syncInstalledSourceForProject).toHaveBeenCalledTimes(2);
      expect(calls[0]?.installName).toBe("core-skills");
      expect(calls[0]?.name).toBe("core-skills");
      expect(calls[0]).not.toHaveProperty("defaultTemplates");
      expect(calls[0]?.sourceKind).toBe("local_path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes project extension instances missing from the installed extensions folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-prune-"));
    writeExtension(join(root, "core-skills"), "core-skills");
    const syncInstalledSourceForProject = mock(async () => ({}));
    const pruneProjectExtensionInstances = mock(async () => []);

    try {
      const synced = await syncInstalledExtensionsForProject({
        extensionService: { pruneProjectExtensionInstances, syncInstalledSourceForProject },
        extensionsRoot: root,
        projectId: "project-1",
      });

      expect(synced).toEqual(["core-skills"]);
      expect(pruneProjectExtensionInstances).toHaveBeenCalledWith({
        activeSourcePaths: [join(root, "core-skills")],
        projectId: "project-1",
        snapshotStartedAt: expect.any(String),
        sourcePathPrefix: root,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns empty when the extensions root does not exist", async () => {
    const syncInstalledSourceForProject = mock(async () => ({}));
    const pruneProjectExtensionInstances = mock(async () => []);
    const synced = await syncInstalledExtensionsForProject({
      extensionService: { pruneProjectExtensionInstances, syncInstalledSourceForProject },
      extensionsRoot: "/nonexistent-pstdio-root",
      projectId: "project-1",
    });

    expect(synced).toEqual([]);
    expect(syncInstalledSourceForProject).not.toHaveBeenCalled();
    expect(pruneProjectExtensionInstances).not.toHaveBeenCalled();
  });

  test("skips invalid installed extensions while syncing the valid ones", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-invalid-"));
    writeExtension(join(root, "core-skills"), "core-skills");
    writeInvalidExtension(join(root, "extension-lab"));
    const syncInstalledSourceForProject = mock(async () => ({}));
    const failures: Array<{ installName: string; message: string; sourcePath: string }> = [];

    try {
      const synced = await syncInstalledExtensionsForProject({
        extensionService: { syncInstalledSourceForProject },
        extensionsRoot: root,
        onLoadFailure: ({ error, installName, sourcePath }) => {
          failures.push({
            installName,
            message: error instanceof Error ? error.message : String(error),
            sourcePath,
          });
        },
        projectId: "project-1",
      });

      expect(synced).toEqual(["core-skills"]);
      expect(syncInstalledSourceForProject).toHaveBeenCalledTimes(1);
      expect(failures).toEqual([
        {
          installName: "extension-lab",
          message: expect.stringContaining("package.json"),
          sourcePath: join(root, "extension-lab"),
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("syncs installed extensions for every existing project", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-projects-"));
    writeExtension(join(root, "core-skills"), "core-skills");
    const calls: Array<Record<string, unknown>> = [];
    const syncInstalledSourceForProject = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return {};
    });

    try {
      const synced = await syncInstalledExtensionsForProjects({
        extensionService: { syncInstalledSourceForProject },
        extensionsRoot: root,
        projectService: {
          list: mock(async () => [{ id: "project-1" }, { id: "project-2" }]),
        },
      });

      expect(synced).toEqual([
        { installName: "core-skills", projectId: "project-1" },
        { installName: "core-skills", projectId: "project-2" },
      ]);
      expect(calls.map((call) => call.projectId)).toEqual(["project-1", "project-2"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
