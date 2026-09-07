import { type FuseConfig, FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from "@electron/fuses";
import { resolvePackagedLayout } from "../packaging/package-layout";

const expectedFuseStates = new Map<FuseV1Options, FuseState>([
  [FuseV1Options.RunAsNode, FuseState.DISABLE],
  [FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE],
  [FuseV1Options.WasmTrapHandlers, FuseState.ENABLE],
]);

export const assertDesktopFuses = (wire: FuseConfig<FuseState>) => {
  if (wire.version !== FuseVersion.V1) throw new Error(`Unsupported desktop fuse version ${wire.version}`);
  for (const [option, expected] of expectedFuseStates) {
    if (wire[option] !== expected) {
      throw new Error(`Desktop fuse ${FuseV1Options[option]} is ${wire[option]}, expected ${expected}`);
    }
  }
};

export const verifyPackagedDesktopFuses = async (desktopRoot: string, platform: NodeJS.Platform, arch: string) => {
  const { executable: executablePath } = resolvePackagedLayout(desktopRoot, platform, arch);
  assertDesktopFuses(await getCurrentFuseWire(executablePath));
  return executablePath;
};
