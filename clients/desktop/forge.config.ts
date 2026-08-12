import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { resolveDesktopSigning } from "./src/release/release-config";

const desktopRoot = import.meta.dirname;
const assetsRoot = join(desktopRoot, "assets");
const signing = resolveDesktopSigning({
  platform: process.platform,
  release: process.env.PSTDIO_DESKTOP_RELEASE === "1",
  env: process.env,
});
const run = (args: string[]) => {
  const result = spawnSync("bun", args, { cwd: desktopRoot, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Desktop package preparation failed: bun ${args.join(" ")}`);
};

const config: ForgeConfig = {
  outDir: "out",
  packagerConfig: {
    appBundleId: "studio.prompt.desktop",
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
    executableName: "Prompt Studio",
    extraResource: [join(desktopRoot, ".sidecar", "bin")],
    icon: join(assetsRoot, "icon"),
    ignore: [
      /^\/\.sidecar($|\/)/,
      /^\/assets($|\/)/,
      /^\/node_modules($|\/)/,
      /^\/scripts($|\/)/,
      /^\/src($|\/)/,
      /^\/test-results($|\/)/,
      /^\/forge\.config\.ts$/,
      /^\/playwright\.config\.ts$/,
      /^\/tsconfig\.json$/,
      /^\/vite\.config\.ts$/,
    ],
    prune: false,
    osxSign: signing.osxSign,
    osxNotarize: signing.osxNotarize,
    windowsSign: signing.windowsSign,
  },
  hooks: {
    prePackage: async (_forgeConfig, platform, arch) => {
      run(["run", "build:sidecar", "--", "--platform", platform, "--arch", arch]);
      run(["run", "build"]);
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: { name: "PromptStudio", windowsSign: signing.squirrelWindowsSign },
    },
    { name: "@electron-forge/maker-zip", platforms: ["darwin", "linux"], config: {} },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: { name: "Prompt Studio", icon: join(assetsRoot, "icon.icns"), format: "ULFO" },
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          bin: "Prompt Studio",
          homepage: "https://prompt.studio",
          icon: join(assetsRoot, "icon.png"),
          maintainer: "Prompt Studio <support@prompt.studio>",
          name: "prompt-studio",
          productName: "Prompt Studio",
        },
      },
    },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      strictlyRequireAllFuses: true,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      [FuseV1Options.WasmTrapHandlers]: true,
    }),
  ],
};

export default config;
