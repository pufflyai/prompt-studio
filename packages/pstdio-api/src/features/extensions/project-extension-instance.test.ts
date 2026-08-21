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
  test("marks release-managed Git sources as upgradable", () => {
    const result = toProjectExtensionInstance(instance, installedSource, "hash-1", {
      releaseUpgradesEnabled: true,
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
      { releaseUpgradesEnabled: true },
    );

    expect(result.status).toBe("error");
    expect(result.lastError).toMatchObject({
      code: "extension_manifest_unsupported_api_version",
    });
    expect(result.lastError?.message).toContain("1.0.0-alpha.1");
    expect(result.lastError?.message).toContain(EXTENSION_API_VERSION);
  });

  test("does not offer release upgrades for local source", () => {
    const result = toProjectExtensionInstance(instance, { ...installedSource, source_kind: "local_path" }, "hash-1", {
      releaseUpgradesEnabled: true,
    });

    expect(result.canUpgrade).toBe(false);
  });
});
