import { describe, expect, mock, test } from "bun:test";
import { namedSourceRef } from "../features/extensions/install-extension-source";
import {
  createExtensionUpgradeService,
  ExtensionUpgradeUnavailableError,
  resolveExtensionReleaseCommit,
} from "./extension-upgrade-service";

const instance = {
  id: "instance-1",
  scope_id: "project-1",
  scope_type: "project",
  enabled: true,
};

const installedSource = {
  id: "installed-1",
  install_name: "pstdio-planner",
  extension_id: "pstdio.pstdio-planner",
  display_name: "Prompt Studio Planner",
  source_hash: "old-hash",
  source_kind: "git",
  source_path: "/home/user/.pstdio/extensions/pstdio-planner",
  source_ref: "https://github.com/pufflyai/prompt-studio@old-commit#extensions/pstdio-planner",
};

const installed = {
  check: {} as never,
  installName: "pstdio-planner",
  manifest: { name: "pstdio-planner" },
  metadata: {
    id: "pstdio.pstdio-planner",
    name: "pstdio-planner",
    displayName: "Prompt Studio Planner",
    version: "0.8.0",
    enginesPstdio: "1.0.0-alpha.2",
  },
  source: {
    kind: "named" as const,
    name: "pstdio-planner",
    ref: "https://github.com/pufflyai/prompt-studio@commit#extensions/pstdio-planner",
  },
  sourceHash: "new-hash",
  targetPath: "/home/user/.pstdio/extensions/pstdio-planner",
};

describe("extension upgrade service", () => {
  test("resolves an annotated release tag to its commit", async () => {
    const releaseCommit = "b".repeat(40);
    const run = mock(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: `${"a".repeat(40)}\trefs/tags/pstdio@0.27.0\n${releaseCommit}\trefs/tags/pstdio@0.27.0^{}\n`,
    }));

    expect(await resolveExtensionReleaseCommit("pstdio@0.27.0", run)).toBe(releaseCommit);
  });

  test("does not offer an upgrade when the installed source matches the host release", async () => {
    const releaseCommit = "a".repeat(40);
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      releaseRef: releaseCommit,
      repoService: { listByProject: async () => [] },
    });

    const result = await service.canUpgrade({
      ...installedSource,
      source_ref: namedSourceRef(releaseCommit, installedSource.install_name),
    });

    expect(result).toBe(false);
  });

  test("compares the installed commit with a symbolic host release once", async () => {
    const releaseCommit = "b".repeat(40);
    const resolveReleaseCommit = mock(async () => releaseCommit);
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      releaseRef: "pstdio@0.27.0",
      resolveReleaseCommit,
      repoService: { listByProject: async () => [] },
    });
    const currentSource = {
      ...installedSource,
      source_ref: namedSourceRef(releaseCommit, installedSource.install_name),
    };

    expect(await service.canUpgrade(currentSource)).toBe(false);
    expect(await service.canUpgrade(currentSource)).toBe(false);
    expect(resolveReleaseCommit).toHaveBeenCalledTimes(1);
  });

  test("offers an upgrade when the installed commit is older than the host release", async () => {
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      releaseRef: "c".repeat(40),
      repoService: { listByProject: async () => [] },
    });

    expect(
      await service.canUpgrade({
        ...installedSource,
        source_ref: namedSourceRef("d".repeat(40), installedSource.install_name),
      }),
    ).toBe(true);
  });

  test("replaces a named extension with the source from the host release", async () => {
    const installExtensionSource = mock(async () => installed as never);
    const registerInstalledSource = mock(async () => ({ ...installedSource, source_hash: "new-hash" }) as never);
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => ({ instance, installedSource }) as never,
        registerInstalledSource,
      },
      installExtensionSource,
      releaseRef: "pstdio@0.27.0",
      repoService: { listByProject: async () => [] },
    });

    const result = await service.upgrade("project-1", "instance-1");

    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        installName: "pstdio-planner",
        ref: "pstdio@0.27.0",
        source: "pstdio-planner",
      }),
    );
    expect(registerInstalledSource).toHaveBeenCalledWith(
      expect.objectContaining({
        installName: "pstdio-planner",
        sourceHash: "new-hash",
        sourceKind: "git",
      }),
    );
    expect(result?.changed).toBe(true);
    expect(result?.instance.id).toBe(instance.id);
  });

  test("prepares one release-scoped preview for concurrent contribution reads", async () => {
    let finishInstall: ((value: typeof installed) => void) | undefined;
    const installExtensionSource = mock(
      () =>
        new Promise<typeof installed>((resolve) => {
          finishInstall = resolve;
        }),
    );
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () => null as never,
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      installExtensionSource: installExtensionSource as never,
      releaseRef: "pstdio@0.27.0",
      repoService: { listByProject: async () => [] },
    });

    const first = service.prepareMarketplaceExtensionSource("pstdio-planner");
    const second = service.prepareMarketplaceExtensionSource("pstdio-planner");

    expect(installExtensionSource).toHaveBeenCalledTimes(1);
    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          PSTDIO_HOME: expect.stringContaining("cache/extension-catalog/pstdio%400.27.0"),
        }),
        force: true,
        installName: "pstdio-planner",
        ref: "pstdio@0.27.0",
        source: "pstdio-planner",
      }),
    );

    finishInstall?.(installed);
    expect(await first).toBe(installed);
    expect(await second).toBe(installed);
  });

  test("refuses to replace a local source", async () => {
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () =>
          ({
            instance,
            installedSource: { ...installedSource, source_kind: "local_path" },
          }) as never,
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      installExtensionSource: async () => {
        throw new Error("should not install");
      },
      releaseRef: "pstdio@0.27.0",
      repoService: { listByProject: async () => [] },
    });

    expect(service.upgrade("project-1", "instance-1")).rejects.toBeInstanceOf(ExtensionUpgradeUnavailableError);
  });

  test("refuses a Git extension that is not in the marketplace", async () => {
    const service = createExtensionUpgradeService({
      extensionService: {
        enableInstalledSourceForProject: async () => {
          throw new Error("should not enable");
        },
        getInstalledSource: async () => null as never,
        getProjectExtensionInstance: async () =>
          ({
            instance,
            installedSource: { ...installedSource, install_name: "extension-lab" },
          }) as never,
        registerInstalledSource: async () => {
          throw new Error("should not register");
        },
      },
      installExtensionSource: async () => {
        throw new Error("should not install");
      },
      releaseRef: "pstdio@0.27.0",
      repoService: { listByProject: async () => [] },
    });

    expect(service.upgrade("project-1", "instance-1")).rejects.toBeInstanceOf(ExtensionUpgradeUnavailableError);
  });
});
