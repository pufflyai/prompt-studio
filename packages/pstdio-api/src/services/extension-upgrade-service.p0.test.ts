import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { packagedExtensionCatalog } from "../features/extensions/extension-catalog";
import { namedSourceRef } from "../features/extensions/install-extension-source";
import { parseExtensionSourceRef, resolveExtensionReleaseCommit } from "./extension-source-ref";
import { createExtensionUpgradeService } from "./extension-upgrade-service";
import { ExtensionUpgradeUnavailableError } from "./extension-upgrade-unavailable-error";

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
  display_name: "Project Planner",
  source_hash: "old-hash",
  source_kind: "git",
  source_path: "/home/user/.pstdio/extensions/pstdio-planner",
  source_ref: namedSourceRef("0".repeat(40), "pstdio-planner"),
};

const installed = {
  check: {} as never,
  installName: "pstdio-planner",
  manifest: { name: "pstdio-planner" },
  metadata: {
    id: "pstdio.pstdio-planner",
    name: "pstdio-planner",
    displayName: "Project Planner",
    version: "0.8.0",
    enginesPstdio: "^0.1.0",
  },
  source: {
    kind: "named" as const,
    name: "pstdio-planner",
    ref: namedSourceRef("b".repeat(40), "pstdio-planner"),
  },
  sourceHash: "new-hash",
  targetPath: "/home/user/.pstdio/extensions/pstdio-planner",
};

const idleExtensionService = {
  enableInstalledSourceForProject: async () => {
    throw new Error("should not enable");
  },
  getInstalledSource: async () => null as never,
  getProjectExtensionInstance: async () => null as never,
  listProjectExtensionInstances: async () => [],
  registerInstalledSource: async () => {
    throw new Error("should not register");
  },
};

const emptyWorkspaceService = { getDefault: async () => null };

describe("extension upgrade service", () => {
  test("rejects command and insecure transports for release lookup", async () => {
    for (const url of ["ext::sh -c touch% /tmp/probe", "http://example.com/repo", "ssh://example.com/repo"]) {
      await expect(resolveExtensionReleaseCommit(url, "main")).rejects.toThrow("HTTPS or file URL");
    }
  });

  test("ignores a recorded source whose origin is not an https or file URL", () => {
    const commit = "d".repeat(40);

    expect(parseExtensionSourceRef(`--upload-pack=touch /tmp/probe;@${commit}#extensions/x`)).toBeNull();
    expect(parseExtensionSourceRef(`ext::sh -c touch% /tmp/probe@${commit}#extensions/x`)).toBeNull();
    expect(parseExtensionSourceRef(`https://example.com/extensions.git@${commit}#extensions/x`)).toEqual({
      commit,
      path: "extensions/x",
      url: "https://example.com/extensions.git",
    });
  });

  test("does not offer an upgrade when the installed source matches the host release", async () => {
    const releaseCommit = "a".repeat(40);
    const service = createExtensionUpgradeService({
      extensionService: idleExtensionService,
      release: { source: "git", ref: releaseCommit },
      workspaceService: emptyWorkspaceService,
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
      extensionService: idleExtensionService,
      release: { source: "git", ref: "pstdio@0.27.0" },
      resolveReleaseCommit,
      workspaceService: emptyWorkspaceService,
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
      extensionService: idleExtensionService,
      release: { source: "git", ref: "c".repeat(40) },
      workspaceService: emptyWorkspaceService,
    });

    expect(
      await service.canUpgrade({
        ...installedSource,
        source_ref: namedSourceRef("d".repeat(40), installedSource.install_name),
      }),
    ).toBe(true);
  });

  test("offers an upgrade for an incompatible marketplace source adopted without provenance", async () => {
    const service = createExtensionUpgradeService({
      extensionService: idleExtensionService,
      release: { source: "git", ref: "c".repeat(40) },
      workspaceService: emptyWorkspaceService,
    });

    // Discovery creates rows for extensions it finds on disk. Those rows carry no install
    // provenance, and the upgrade path is the only recovery for them after an API change.
    expect(
      await service.canUpgrade({
        ...installedSource,
        manifest_json: { name: "pstdio-planner", enginesPstdio: "^1.0.0" },
        source_ref: null,
      }),
    ).toBe(true);
  });

  test("leaves a healthy source without provenance under local control", async () => {
    const service = createExtensionUpgradeService({
      extensionService: idleExtensionService,
      release: { source: "git", ref: "c".repeat(40) },
      workspaceService: emptyWorkspaceService,
    });

    expect(
      await service.canUpgrade({
        ...installedSource,
        manifest_json: { name: "pstdio-planner", enginesPstdio: `^${EXTENSION_API_VERSION}` },
        source_ref: null,
      }),
    ).toBe(false);
  });

  test("does not offer an upgrade for an extension outside the marketplace", async () => {
    const service = createExtensionUpgradeService({
      extensionService: idleExtensionService,
      release: { source: "git", ref: "c".repeat(40) },
      workspaceService: emptyWorkspaceService,
    });

    expect(
      await service.canUpgrade({
        ...installedSource,
        install_name: "external-tool",
        manifest_json: { name: "external-tool", enginesPstdio: "^1.0.0" },
        source_ref: null,
      }),
    ).toBe(false);
  });
});

describe("catalog extension installation and upgrades", () => {
  test("replaces a named extension with the source from the host release", async () => {
    const installExtensionSource = mock(async () => installed as never);
    const registerInstalledSource = mock(async () => ({ ...installedSource, source_hash: "new-hash" }) as never);
    const service = createExtensionUpgradeService({
      extensionService: {
        ...idleExtensionService,
        getProjectExtensionInstance: async () =>
          ({
            instance,
            installedSource: {
              ...installedSource,
              source_ref: namedSourceRef("d".repeat(40), installedSource.install_name),
            },
          }) as never,
        registerInstalledSource,
      },
      installExtensionSource,
      release: { source: "git", ref: "pstdio@0.27.0" },
      resolveReleaseCommit: async () => "e".repeat(40),
      workspaceService: emptyWorkspaceService,
    });

    const result = await service.upgrade("project-1", "instance-1");

    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        installName: "pstdio-planner",
        hostReleaseRef: "pstdio@0.27.0",
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
      extensionService: idleExtensionService,
      installExtensionSource: installExtensionSource as never,
      release: { source: "git", ref: "pstdio@0.27.0" },
      workspaceService: emptyWorkspaceService,
    });

    const first = service.prepareMarketplaceExtensionSource("pstdio-planner");
    const second = service.prepareMarketplaceExtensionSource("pstdio-planner");
    await Bun.sleep(0);

    expect(installExtensionSource).toHaveBeenCalledTimes(1);
    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          PSTDIO_HOME: expect.stringContaining(join("cache", "extension-catalog", "https%3A%2F%2Fgithub.com")),
        }),
        force: true,
        installName: "pstdio-planner",
        hostReleaseRef: "pstdio@0.27.0",
        repoPath: expect.stringContaining(join("cache", "extension-catalog")),
        source: "pstdio-planner",
      }),
    );

    finishInstall?.(installed);
    expect(await first).toBe(installed);
    expect(await second).toBe(installed);
  });

  test("replaces a marketplace source that was adopted without provenance", async () => {
    const installExtensionSource = mock(async () => installed as never);
    const registerInstalledSource = mock(async () => ({ ...installedSource, source_hash: "new-hash" }) as never);
    const service = createExtensionUpgradeService({
      extensionService: {
        ...idleExtensionService,
        getProjectExtensionInstance: async () =>
          ({
            instance,
            installedSource: {
              ...installedSource,
              manifest_json: { name: "pstdio-planner", enginesPstdio: "^1.0.0" },
              source_kind: "local_path",
              source_ref: null,
            },
          }) as never,
        registerInstalledSource,
      },
      installExtensionSource,
      release: { source: "git", ref: "pstdio@0.27.0" },
      workspaceService: emptyWorkspaceService,
    });

    const result = await service.upgrade("project-1", "instance-1");

    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        installName: "pstdio-planner",
        hostReleaseRef: "pstdio@0.27.0",
        source: "pstdio-planner",
      }),
    );
    expect(result?.changed).toBe(true);
  });

  test("refuses a Git extension that is not in the marketplace", async () => {
    const service = createExtensionUpgradeService({
      extensionService: {
        ...idleExtensionService,
        getProjectExtensionInstance: async () =>
          ({
            instance,
            installedSource: { ...installedSource, install_name: "extension-lab", source_ref: null },
          }) as never,
      },
      installExtensionSource: async () => {
        throw new Error("should not install");
      },
      release: { source: "git", ref: "pstdio@0.27.0" },
      workspaceService: emptyWorkspaceService,
    });

    expect(service.upgrade("project-1", "instance-1")).rejects.toBeInstanceOf(ExtensionUpgradeUnavailableError);
  });

  test("upgrades a source-ref extension without a catalog entry", async () => {
    const originUrl = "https://example.com/acme/extensions.git";
    const sourceRef = `${originUrl}@${"1".repeat(40)}#extensions/recipes`;
    const installExtensionSource = mock(async (input: { prepareNamedSource?: (...args: never[]) => unknown }) => {
      expect(input.prepareNamedSource).toBeFunction();
      return installed as never;
    });
    const registerInstalledSource = mock(
      async () =>
        ({
          ...installedSource,
          install_name: "acme-recipes",
          source_ref: `${originUrl}@${"2".repeat(40)}#extensions/recipes`,
        }) as never,
    );
    const service = createExtensionUpgradeService({
      extensionService: {
        ...idleExtensionService,
        getProjectExtensionInstance: async () =>
          ({
            instance,
            installedSource: { ...installedSource, install_name: "acme-recipes", source_ref: sourceRef },
          }) as never,
        registerInstalledSource,
      },
      installExtensionSource: installExtensionSource as never,
      release: { source: "git", ref: "v2.0.0" },
      resolveReleaseCommit: async () => "2".repeat(40),
      workspaceService: emptyWorkspaceService,
    });

    const result = await service.upgrade("project-1", "instance-1");

    expect(installExtensionSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "acme-recipes", ref: "v2.0.0", force: true }),
    );
    expect(result?.changed).toBe(true);
  });

  test("offers catalog-managed upgrades from a third-party repository", async () => {
    const oldCommit = "1".repeat(40);
    const newCommit = "2".repeat(40);
    const originUrl = "https://example.com/acme/extensions.git";
    const resolveReleaseCommit = mock(async () => newCommit);
    const service = createExtensionUpgradeService({
      catalog: {
        version: 1,
        extensions: [
          ...packagedExtensionCatalog.extensions,
          {
            installName: "acme-recipes",
            displayName: "Recipes",
            description: "Recipe tools.",
            origin: { kind: "git", url: originUrl, path: "extensions/recipes", ref: "v2.0.0" },
            publisher: "acme",
            default: false,
          },
        ],
      },
      extensionService: idleExtensionService,
      release: null,
      workspaceService: emptyWorkspaceService,
      resolveReleaseCommit,
    });

    expect(
      await service.canUpgrade({
        install_name: "acme-recipes",
        source_ref: `${originUrl}@${oldCommit}#extensions/recipes`,
      }),
    ).toBe(true);
    expect(resolveReleaseCommit).toHaveBeenCalledWith(originUrl, "v2.0.0");
  });
});

describe("catalog Git installs on a registry host", () => {
  const registryHost = (versions: string[]) => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        Response.json({
          versions: versions.map((version) => ({
            id: "pstdio.pstdio-planner",
            version,
            enginesPstdio: `^${EXTENSION_API_VERSION}`,
            sha256: "0".repeat(64),
            withdrawn: false,
          })),
        }),
    });
    const service = createExtensionUpgradeService({
      extensionService: idleExtensionService,
      release: { source: "registry", ref: `psx:${server.url.origin}` },
      workspaceService: emptyWorkspaceService,
    });
    return { service, stop: () => server.stop(true) };
  };

  test("offers the newer registry release to an install from the catalog's Git source", async () => {
    const host = registryHost(["0.8.0", "0.8.1"]);
    try {
      expect(await host.service.canUpgrade({ ...installedSource, version: "0.8.0" })).toBe(true);
      expect(await host.service.canUpgrade({ ...installedSource, version: "0.8.1" })).toBe(false);
    } finally {
      host.stop();
    }
  });

  test("keeps an explicit Git install from another repository on its own source", async () => {
    const host = registryHost(["0.8.1"]);
    try {
      const source_ref = `https://example.com/fork@${"0".repeat(40)}#extensions/pstdio-planner`;
      expect(await host.service.canUpgrade({ ...installedSource, source_ref, version: "0.8.0" })).toBe(false);
    } finally {
      host.stop();
    }
  });
});
