import { describe, expect, mock, test } from "bun:test";
import { createExtensionUpgradeService } from "./extension-upgrade-service";

describe("marketplace extension installation", () => {
  test("installs a repo-scoped marketplace extension from the current source checkout", async () => {
    const repoPath = "/repos/project";
    const sourceRoot = "/checkout/prompt-studio";
    const targetPath = `${repoPath}/.pstdio/extensions/pstdio-planner-loops`;
    const installed = {
      check: {} as never,
      installName: "pstdio-planner-loops",
      manifest: { name: "pstdio-planner-loops", pstdio: { scope: "repo" } },
      metadata: {
        id: "pstdio.pstdio-planner-loops",
        name: "pstdio-planner-loops",
        displayName: "Prompt Studio Planner Automation",
        version: "0.1.0",
        enginesPstdio: "1.0.0-alpha.4",
      },
      source: {
        kind: "local" as const,
        path: `${sourceRoot}/.pstdio/extensions/pstdio-planner-loops`,
      },
      sourceHash: "source-hash",
      targetPath,
    };
    const result = {
      installedSource: {
        id: "installed-1",
        install_name: "pstdio-planner-loops",
        extension_id: "pstdio.pstdio-planner-loops",
        display_name: "Prompt Studio Planner Automation",
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
      releaseRef: "pstdio@0.27.0",
      repoService: {
        listByProject: async () => [
          {
            id: "repo-1",
            name: "project",
            display_name: null,
            path: repoPath,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      sourceRoot,
    });

    expect(await service.installMarketplaceExtension("project-1", "pstdio-planner-loops")).toMatchObject({
      installedSource: { install_name: "pstdio-planner-loops" },
      instance: { id: "instance-1" },
    });
    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        installName: "pstdio-planner-loops",
        repoPath,
        skipInstall: true,
        source: `${sourceRoot}/.pstdio/extensions/pstdio-planner-loops`,
      }),
    );
    expect(enableInstalledSourceForProject).toHaveBeenCalledWith(
      expect.objectContaining({
        installName: "pstdio-planner-loops",
        projectId: "project-1",
        sourcePath: targetPath,
      }),
    );
  });
});
