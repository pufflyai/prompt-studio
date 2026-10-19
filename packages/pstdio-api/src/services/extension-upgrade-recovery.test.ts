import { describe, expect, test } from "bun:test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { namedSourceRef } from "../features/extensions/install-extension-source";
import { createExtensionUpgradeService } from "./extension-upgrade-service";

const unused = async () => {
  throw new Error("Unexpected extension mutation");
};

const service = () =>
  createExtensionUpgradeService({
    extensionService: {
      enableInstalledSourceForProject: unused,
      getInstalledSource: unused,
      getProjectExtensionInstance: unused,
      listProjectExtensionInstances: unused,
      registerInstalledSource: unused,
    },
    workspaceService: { getDefault: async () => null },
    release: { source: "git", ref: "c".repeat(40) },
  });

const planner = {
  install_name: "pstdio-planner",
  source_ref: null,
  manifest_json: { name: "pstdio-planner", enginesPstdio: `^${EXTENSION_API_VERSION}` },
};

describe("catalog upgrade recovery", () => {
  test.each(["git", "registry"])("recovers a compatible %s install with no release reference", async (sourceKind) => {
    expect(await service().canUpgrade({ ...planner, source_kind: sourceKind })).toBe(true);
  });

  test("recovers a managed install with an older reference format", async () => {
    expect(await service().canUpgrade({ ...planner, source_kind: "git", source_ref: "pstdio-planner@0.43.1" })).toBe(
      true,
    );
  });

  test("keeps a compatible local source under its owner's control", async () => {
    expect(await service().canUpgrade({ ...planner, source_kind: "local_path" })).toBe(false);
    expect(await service().upgradeAvailability({ ...planner, source_kind: "local_path" })).toEqual({
      canUpgrade: false,
      upgradeBlockedReason: "local_source",
    });
  });

  test("explains when a catalog name belongs to another Git origin", async () => {
    expect(
      await service().upgradeAvailability({
        ...planner,
        source_kind: "git",
        source_ref: `https://example.com/custom-planner@${"a".repeat(40)}#extensions/pstdio-planner`,
      }),
    ).toEqual({ canUpgrade: false, upgradeBlockedReason: "different_origin" });
  });

  test("keeps recorded release provenance when discovery calls the source local", async () => {
    expect(
      await service().canUpgrade({
        ...planner,
        source_kind: "local_path",
        source_ref: namedSourceRef("a".repeat(40), "pstdio-planner"),
      }),
    ).toBe(true);
  });
});
