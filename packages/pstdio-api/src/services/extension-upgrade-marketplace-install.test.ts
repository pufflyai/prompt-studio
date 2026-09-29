import { describe, expect, mock, test } from "bun:test";
import { join, resolve } from "node:path";
import { RepoScopedExtensionNeedsProjectFolderError } from "../features/extensions/install-extension-source";
import { createExtensionUpgradeService, ExtensionUpgradeUnavailableError } from "./extension-upgrade-service";

const repoToolsCatalog = {
  version: 1 as const,
  extensions: [
    {
      installName: "repo-tools",
      displayName: "Repo Tools",
      description: "Repository-owned tools.",
      origin: {
        kind: "git" as const,
        url: "https://github.com/pufflyai/prompt-studio",
        path: ".pstdio/extensions/repo-tools",
        ref: "{hostRelease}",
      },
      publisher: "pufflyai",
      default: false,
    },
  ],
};

describe("marketplace extension installation", () => {
  test("loads marketplace sources from the configured workspace release", async () => {
    const sourceRoot = resolve("/workspace/prompt-studio");
    const installExtensionSource = mock(async () => ({}) as never);
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => null as never,
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        listProjectExtensionInstances: async () => [],
        registerInstalledSource: async () => null as never,
      },
      installExtensionSource,
      release: { source: "workspace", ref: "workspace-ref", root: sourceRoot },
      workspaceService: { getDefault: async () => null },
    });

    await service.prepareMarketplaceExtensionSource("pstdio-planner");

    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          PSTDIO_HOME: expect.stringContaining(join("cache", "extension-catalog", "https%3A%2F%2Fgithub.com")),
        }),
        force: true,
        installName: "pstdio-planner",
        reuseInstalledDependencies: true,
        skipInstall: true,
        source: join(sourceRoot, "extensions", "pstdio-planner"),
      }),
    );
  });

  test("installs a repo-scoped marketplace extension from the current source checkout", async () => {
    const repoPath = resolve("/repos/project");
    const sourceRoot = resolve("/checkout/prompt-studio");
    const targetPath = join(repoPath, ".pstdio", "extensions", "repo-tools");
    const installed = {
      check: {} as never,
      installName: "repo-tools",
      manifest: { name: "repo-tools", pstdio: { scope: "repo" } },
      metadata: {
        id: "pstdio.repo-tools",
        name: "repo-tools",
        displayName: "Repo Tools",
        version: "0.1.0",
        enginesPstdio: "1.0.0-alpha.4",
      },
      source: {
        kind: "local" as const,
        path: join(sourceRoot, ".pstdio", "extensions", "repo-tools"),
      },
      sourceHash: "source-hash",
      targetPath,
    };
    const result = {
      installedSource: {
        id: "installed-1",
        install_name: "repo-tools",
        extension_id: "pstdio.repo-tools",
        display_name: "Repo Tools",
        source_hash: "source-hash",
        source_kind: "local_path",
        source_path: targetPath,
        source_ref: null,
      },
      instance: {
        id: "instance-1",
        scope_id: "project-1",
        scope_type: "project",
        enabled: true,
      },
    };
    const installExtensionSource = mock(async () => installed as never);
    const enableInstalledSourceForProject = mock(async () => result as never);
    const service = createExtensionUpgradeService({
      catalog: repoToolsCatalog,
      extensionService: {
        enableInstalledSourceForProject,
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        listProjectExtensionInstances: async () => [],
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      installExtensionSource,
      release: { source: "workspace", ref: "workspace-ref", root: sourceRoot },
      workspaceService: {
        getDefault: async () => ({
          id: "home",
          project_id: "project-1",
          root_path: repoPath,
          execution_kind: "local",
          provider_id: "pstdio.root",
          provider_state: "ready",
        }),
      },
    });

    expect(await service.installMarketplaceExtension("project-1", "repo-tools")).toMatchObject({
      installedSource: { install_name: "repo-tools" },
      instance: { id: "instance-1" },
    });
    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        installName: "repo-tools",
        repoPath,
        skipInstall: true,
        source: join(sourceRoot, ".pstdio", "extensions", "repo-tools"),
      }),
    );
    expect(enableInstalledSourceForProject).toHaveBeenCalledWith(
      expect.objectContaining({
        installName: "repo-tools",
        projectId: "project-1",
        sourcePath: targetPath,
      }),
    );
  });

  test("reports that a repo-scoped extension needs a project with a local folder", async () => {
    const service = createExtensionUpgradeService({
      catalog: repoToolsCatalog,
      extensionService: {
        enableInstalledSourceForProject: async () => null as never,
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        listProjectExtensionInstances: async () => [],
        registerInstalledSource: async () => null as never,
      },
      installExtensionSource: async () => {
        throw new RepoScopedExtensionNeedsProjectFolderError("pstdio.repo-tools");
      },
      release: { source: "workspace", ref: "workspace-ref", root: resolve("/checkout/prompt-studio") },
      workspaceService: { getDefault: async () => ({ root_path: null }) },
    });

    await expect(service.installMarketplaceExtension("project-1", "repo-tools")).rejects.toBeInstanceOf(
      ExtensionUpgradeUnavailableError,
    );
  });
});
