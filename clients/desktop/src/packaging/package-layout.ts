import { join } from "node:path";

// The Linux SUID sandbox cannot launch paths with spaces. See ADR 0019.
export const desktopPackageName = (platform: NodeJS.Platform) =>
  platform === "linux" ? "prompt-studio" : "Prompt Studio";

// Squirrel packs the Windows installer with NuGet 2, which accepts only SemVer 1 versions:
// a prerelease part without dots and with at most 20 characters. Squirrel then orders
// releases by reading the digits right after a letter as a 32-bit number, so a joined
// `nightly20261026030503` overflows. A hyphen keeps the timestamp apart from the label, and
// Squirrel compares `nightly-202610260305` as text, which keeps fixed-width timestamps in
// order. Cutting at 20 characters keeps minute precision. The app keeps its full version.
export const windowsPackageVersion = (version: string) => {
  const [release, ...prerelease] = version.split("-");
  if (!prerelease.length) return release!;
  return `${release}-${prerelease.join("-").replaceAll(".", "-").slice(0, 20)}`;
};

export const resolvePackagedLayout = (desktopRoot: string, platform: NodeJS.Platform, arch: string) => {
  const name = desktopPackageName(platform);
  const root = join(desktopRoot, "out", `${name}-${platform}-${arch}`);
  if (platform === "darwin") {
    const contents = join(root, `${name}.app`, "Contents");
    return {
      root,
      executable: join(contents, "MacOS", name),
      sidecar: join(contents, "Resources", "bin", "pstdio"),
    };
  }
  const extension = platform === "win32" ? ".exe" : "";
  return {
    root,
    executable: join(root, `${name}${extension}`),
    sidecar: join(root, "resources", "bin", `pstdio${extension}`),
  };
};
