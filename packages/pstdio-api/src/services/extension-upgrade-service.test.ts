import { describe, expect, mock, test } from "bun:test";
import { createExtensionUpgradeService, ExtensionUpgradeUnavailableError } from "./extension-upgrade-service";

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
};

const installed = {
  installName: "pstdio-planner",
  manifest: { name: "pstdio-planner" },
  metadata: {
    id: "pstdio.pstdio-planner",
    name: "pstdio-planner",
    displayName: "Prompt Studio Planner",
    version: "0.8.0",
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
