import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExtension, writeInvalidExtension } from "./default-extensions-test-fixtures";
import { syncInstalledExtensionsForProject, syncInstalledExtensionsForProjects } from "./installed-extension-sync";

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

      expect(synced.map((entry) => entry.installName)).toEqual(["planner", "worktree-setup"]);
      expect(syncInstalledSourceForProject).toHaveBeenCalledTimes(2);
      expect(calls[0]?.installName).toBe("planner");
      expect(calls[0]?.name).toBe("planner");
      expect(calls[0]).not.toHaveProperty("defaultTemplates");
      expect(calls[0]).not.toHaveProperty("sourceKind");
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

      expect(synced.map((entry) => entry.installName)).toEqual(["planner"]);
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

      expect(synced.map((entry) => entry.installName)).toEqual(["planner"]);
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

  test("keeps an incompatible installed extension discoverable for dashboard recovery", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-default-extensions-incompatible-"));
    writeExtension(join(root, "pstdio-planner"), "pstdio-planner", undefined, "1.0.0-alpha.1");
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

      expect(synced).toEqual([{ installName: "pstdio-planner", sourceHash: expect.any(String) }]);
      expect(calls[0]).toMatchObject({
        installName: "pstdio-planner",
        manifest: { enginesPstdio: "1.0.0-alpha.1", version: "1.0.0" },
        version: "1.0.0",
      });
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

      expect(synced.map((entry) => entry.installName)).toEqual(["planner"]);
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
        projectService: { list: mock(async () => [{ id: "project-1" }, { id: "project-2" }]) },
      });

      expect(synced.map(({ installName, projectId }) => ({ installName, projectId }))).toEqual([
        { installName: "planner", projectId: "project-1" },
        { installName: "planner", projectId: "project-2" },
      ]);
      expect(calls.map((call) => call.projectId)).toEqual(["project-1", "project-2"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
