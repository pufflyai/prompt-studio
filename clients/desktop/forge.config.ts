import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import type { MakerDMGConfig } from "@electron-forge/maker-dmg";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import type { ForgeConfig } from "@electron-forge/shared-types";
import checksums from "electron/checksums.json";
import { version } from "./package.json";
import { writeCliInstallScripts } from "./src/packaging/cli-install-scripts";
import { DeviceDmgMaker } from "./src/packaging/device-dmg-maker";
import { finalizeWindowsSidecar } from "./src/packaging/finalize-windows-sidecar";
import { desktopPackageName } from "./src/packaging/package-layout";
import { notarizeMacApp } from "./src/release/notarize-macos";
import { resolveDesktopSigning } from "./src/release/release-config";
import { validateSidecarArtifact } from "./src/runtime/sidecar-artifact";

const desktopRoot = import.meta.dirname;
const assetsRoot = join(desktopRoot, "assets");
const installScripts = writeCliInstallScripts(join(desktopRoot, "out", "install-scripts"));
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
    // Verify cached Electron archives with the pinned package hashes without another GitHub request.
    download: { checksums },
    appBundleId: "studio.prompt.desktop",
    appCategoryType: "public.app-category.developer-tools",
    asar: true,
    name: desktopPackageName(process.platform),
    executableName: desktopPackageName(process.platform),
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
    osxSign: signing.osxSign && {
      ...signing.osxSign,
      // The runtime is already signed before its manifest is generated. The signer follows the pst link
      // to the runtime too, so it must skip the whole folder.
      ignore: (filePath) => filePath.includes("/Contents/Resources/bin/"),
    },
    windowsSign: signing.windowsSign,
  },
  hooks: {
    postPackage: async (_forgeConfig, result) => {
      if (result.platform === "darwin" && signing.macosNotarization) {
        for (const outputPath of result.outputPaths) {
          await notarizeMacApp(join(outputPath, `${desktopPackageName("darwin")}.app`), signing.macosNotarization);
        }
        return;
      }
      if (result.platform !== "win32" || !signing.windowsSign) return;
      for (const outputPath of result.outputPaths) {
        const resourcesPath = join(outputPath, "resources");
        finalizeWindowsSidecar(resourcesPath);
        await validateSidecarArtifact({ resourcesPath, platform: "win32", arch: result.arch, appVersion: version });
      }
    },
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
    new DeviceDmgMaker(
      {
        name: "Prompt Studio",
        icon: join(assetsRoot, "icon.icns"),
        // appdmg picks up dmg-background@2x.png next to this file for Retina screens.
        background: join(assetsRoot, "dmg-background.png"),
        iconSize: 96,
        // Positions match the clear areas around the arrow in the background artwork.
        contents: ({ appPath }) => [
          { x: 192, y: 260, type: "file", path: appPath },
          { x: 466, y: 260, type: "link", path: "/Applications" },
        ],
        format: "ULFO",
      } satisfies MakerDMGConfig,
      ["darwin"],
    ),
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          bin: desktopPackageName("linux"),
          homepage: "https://prompt.studio",
          icon: join(assetsRoot, "icon.png"),
          maintainer: "Prompt Studio <support@prompt.studio>",
          name: "prompt-studio",
          productName: "Prompt Studio",
          // dpkg reads `-` as a revision and ranks `0.43.0-nightly.1` above `0.43.0`.
          // `~` sorts first, so the stable release replaces its nightlies.
          version: version.replace("-", "~"),
          scripts: {
            postinst: join(installScripts, "postinst"),
            postrm: join(installScripts, "postrm"),
          },
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
