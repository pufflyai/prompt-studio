import { describe, expect, test } from "bun:test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { toProjectExtensionInstance } from "./project-extension-instance";

const instance = {
  id: "instance-1",
  scope_id: "project-1",
  display_name_override: null,
  enabled: true,
  config_json: {},
};

const installedSource = {
  id: "installed-1",
  install_name: "extension-lab",
  extension_id: "pstdio.extension-lab",
  display_name: "Extension Lab",
  source_path: "/home/user/.pstdio/extensions/extension-lab",
  source_kind: "git",
  version: "0.7.2",
  manifest_json: {
    name: "extension-lab",
    enginesPstdio: EXTENSION_API_VERSION,
  },
  source_hash: "hash-1",
  status: "loaded" as const,
  last_loaded_at: "2026-08-20T03:00:19.000Z",
  last_error_json: null,
};

describe("toProjectExtensionInstance", () => {
  test("uses the upgrade eligibility supplied by the upgrade service", () => {
    const result = toProjectExtensionInstance(instance, installedSource, "hash-1", {
      canUpgrade: true,
    });

    expect(result.canUpgrade).toBe(true);
    expect(result.status).toBe("loaded");
  });

  test("reports an incompatible adopted API version as the primary extension error", () => {
    const result = toProjectExtensionInstance(
      instance,
      {
        ...installedSource,
        manifest_json: {
          name: "extension-lab",
          enginesPstdio: "1.0.0-alpha.1",
        },
      },
      "hash-1",
      { canUpgrade: true },
    );

    expect(result.status).toBe("error");
    expect(result.lastError).toMatchObject({
      code: "extension_manifest_unsupported_api_version",
    });
    expect(result.lastError?.message).toContain("1.0.0-alpha.1");
    expect(result.lastError?.message).toContain(EXTENSION_API_VERSION);
  });

  test("does not offer an upgrade when the upgrade service refuses it", () => {
    const result = toProjectExtensionInstance(instance, { ...installedSource, source_kind: "local_path" }, "hash-1", {
      canUpgrade: false,
    });

    expect(result.canUpgrade).toBe(false);
  });

  test("reports scope from where the source is installed", () => {
    const previousHome = process.env.PSTDIO_HOME;
    process.env.PSTDIO_HOME = "/home/user/.pstdio";

    try {
      const global = toProjectExtensionInstance(instance, installedSource);
      expect(global.scope).toBe("global");

      const repo = toProjectExtensionInstance(instance, {
        ...installedSource,
        source_path: "/home/user/projects/my-repo/.pstdio/extensions/extension-lab",
      });
      expect(repo.scope).toBe("repo");
    } finally {
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
    }
  });
});
