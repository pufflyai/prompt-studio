import { expect, test } from "bun:test";
import { FuseState, FuseV1Options, FuseVersion } from "@electron/fuses";
import { assertDesktopFuses } from "./release-fuses";

test("requires the complete hardened desktop fuse policy", () => {
  const wire = {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: FuseState.DISABLE,
    [FuseV1Options.EnableCookieEncryption]: FuseState.ENABLE,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: FuseState.DISABLE,
    [FuseV1Options.EnableNodeCliInspectArguments]: FuseState.DISABLE,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: FuseState.ENABLE,
    [FuseV1Options.OnlyLoadAppFromAsar]: FuseState.ENABLE,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: FuseState.DISABLE,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: FuseState.DISABLE,
    [FuseV1Options.WasmTrapHandlers]: FuseState.ENABLE,
  };

  expect(() => assertDesktopFuses(wire)).not.toThrow();
  wire[FuseV1Options.RunAsNode] = FuseState.ENABLE;
  expect(() => assertDesktopFuses(wire)).toThrow("RunAsNode");
});
