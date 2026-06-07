import { afterEach, describe, expect, mock, test } from "bun:test";
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
  installName: "pstdio-planner",
  targetPath: "/home/user/.pstdio/extensions/pstdio-planner",
  source: { kind: "named" as const, name: "pstdio-planner", ref: "repo#main:extensions/pstdio-planner" },
  metadata: {
    id: "pstdio.pstdio-planner",
    name: "pstdio-planner",
    displayName: "pstdio Planner",
    version: "0.1.0",
    enginesPstdio: "^1.0.0",
  },
  manifest: { id: "pstdio.pstdio-planner" },
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
    navigation: [],
    treeItems: [],
    treeRenderers: [],
    settingsPanels: [],
    dataRenderers: [],
    templates: [],
    skills: [],
    diagnostics: [],
  },
};

let previousEmbeddedFiles: readonly unknown[] | undefined;
let embeddedFilesChanged = false;

const setEmbeddedFiles = (value: readonly unknown[]) => {
  (globalThis.Bun as unknown as { embeddedFiles: unknown[] }).embeddedFiles = [...value];
};

const useEmbeddedFiles = (value: readonly unknown[]) => {
  if (!embeddedFilesChanged) previousEmbeddedFiles = globalThis.Bun.embeddedFiles;
  embeddedFilesChanged = true;
  setEmbeddedFiles(value);
};

const toEmbedded = (name: string, content: string) => ({
  name,
  size: content.length,
  arrayBuffer: async () => new TextEncoder().encode(content).buffer,
});

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

afterEach(() => {
  if (embeddedFilesChanged) {
    setEmbeddedFiles(previousEmbeddedFiles ?? []);
  }

  previousEmbeddedFiles = undefined;
  embeddedFilesChanged = false;
  rmSync(join(tmpdir(), "pstdio-default-extensions"), { recursive: true, force: true });
});

describe("resolveDefaultExtensionsConfig", () => {
  test("returns the production defaults when the env override is absent", () => {
    const config = resolveDefaultExtensionsConfig({});

    expect(config.defaultExtensions).toEqual(["pstdio-planner", "pstdio-skills", "pstdio-worktree-setup"]);
  });

  test("uses PSTDIO_DEFAULT_EXTENSIONS JSON when set", () => {
    const config = resolveDefaultExtensionsConfig({
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([
        { source: "./extensions/pstdio-planner", installName: "planner-dev", skipInstall: true },
      ]),
    });

    expect(config.defaultExtensions).toEqual([
      { source: "./extensions/pstdio-planner", installName: "planner-dev", skipInstall: true },
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
    expect(calls.map((call) => call.installName)).toEqual(["pstdio-planner", "pstdio-skills", "pstdio-worktree-setup"]);
    expect(
      calls.every((call) => typeof call.source === "string" && (call.source as string).includes("/extensions/")),
    ).toBe(true);
    expect(calls.every((call) => call.skipInstall === undefined)).toBe(true);
    expect(calls.every((call) => call.force === true)).toBe(true);
  });

  test("uses embedded source packages for named defaults when local sources are unavailable", async () => {
    const extensionName = "bundled-planner";
    useEmbeddedFiles([
      toEmbedded(
        `../../../extensions/${extensionName}/package.json`,
        JSON.stringify({
          name: extensionName,
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          engines: { pstdio: "^1.0.0" },
        }),
      ),
      toEmbedded(`../../../extensions/${extensionName}/extension.ts`, "export default {};"),
    ]);

    const calls: Array<Record<string, unknown>> = [];
    const installExtensionSource = mock(async (input: Record<string, unknown>) => {
      calls.push(input);
      return { ...installed, installName: extensionName };
    });
    const prepareSharedCheckout = mock(async () => {
      throw new Error("should not prepare a named checkout");
    });

    await installDefaultExtensions({
      env: { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([extensionName]) },
      installExtensionSource,
      prepareSharedCheckout,
    });

    expect(prepareSharedCheckout).not.toHaveBeenCalled();
    expect(installExtensionSource).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      existsOk: true,
      force: true,
      installName: extensionName,
    });
    expect(String(calls[0]?.source)).toContain(join("pstdio-default-extensions", extensionName));
    expect(existsSync(join(String(calls[0]?.source), "package.json"))).toBe(true);
  });

  test("passes existsOk=true and reuses one shared checkout for all named entries", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-shared-"));
    writeExtension(join(root, "pstdio-planner"), "pstdio-planner");
    writeExtension(join(root, "pstdio-worktree-setup"), "pstdio-worktree-setup");
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
        config: { defaultExtensions: ["pstdio-planner", "pstdio-worktree-setup"] },
        installExtensionSource,
        prepareSharedCheckout,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }

    expect(prepareSharedCheckout).toHaveBeenCalledTimes(1);
    expect(prepareSharedCheckout).toHaveBeenCalledWith(["pstdio-planner", "pstdio-worktree-setup"]);
    expect(installExtensionSource).toHaveBeenCalledTimes(2);
    expect(calls[0]?.existsOk).toBe(true);
    expect(calls[0]?.prepareNamedSource).toBe(prepareNamedSource);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("skips the shared checkout when all entries are local paths", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-local-"));
    const source = join(root, "pstdio-planner");
    writeExtension(source, "pstdio-planner");
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
    writeExtension(join(root, "worktree-setup"), "worktree-setup");
    writeExtension(join(root, "planner"), "planner");
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

      expect(synced).toEqual(["planner", "worktree-setup"]);
      expect(syncInstalledSourceForProject).toHaveBeenCalledTimes(2);
      expect(calls[0]?.installName).toBe("planner");
      expect(calls[0]?.name).toBe("planner");
      expect(calls[0]).not.toHaveProperty("defaultTemplates");
      expect(calls[0]?.sourceKind).toBe("local_path");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes project extension instances missing from the installed extensions folder", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-prune-"));
    writeExtension(join(root, "planner"), "planner");
    const syncInstalledSourceForProject = mock(async () => ({}));
    const pruneProjectExtensionInstances = mock(async () => []);

    try {
      const synced = await syncInstalledExtensionsForProject({
        extensionService: { pruneProjectExtensionInstances, syncInstalledSourceForProject },
        extensionsRoot: root,
        projectId: "project-1",
      });

      expect(synced).toEqual(["planner"]);
      expect(pruneProjectExtensionInstances).toHaveBeenCalledWith({
        activeSourcePaths: [join(root, "planner")],
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
    writeExtension(join(root, "planner"), "planner");
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

      expect(synced).toEqual(["planner"]);
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

  test("prunes invalid installed extension folders from project instances", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-invalid-prune-"));
    writeExtension(join(root, "planner"), "planner");
    writeInvalidExtension(join(root, "extension-lab"));
    const syncInstalledSourceForProject = mock(async () => ({}));
    const pruneProjectExtensionInstances = mock(async () => []);

    try {
      const synced = await syncInstalledExtensionsForProject({
        extensionService: { pruneProjectExtensionInstances, syncInstalledSourceForProject },
        extensionsRoot: root,
        projectId: "project-1",
      });

      expect(synced).toEqual(["planner"]);
      expect(pruneProjectExtensionInstances).toHaveBeenCalledWith({
        activeSourcePaths: [join(root, "planner")],
        projectId: "project-1",
        snapshotStartedAt: expect.any(String),
        sourcePathPrefix: root,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("syncs installed extensions for every existing project", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-projects-"));
    writeExtension(join(root, "planner"), "planner");
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
        { installName: "planner", projectId: "project-1" },
        { installName: "planner", projectId: "project-2" },
      ]);
      expect(calls.map((call) => call.projectId)).toEqual(["project-1", "project-2"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
