import { join } from "node:path";

// The Linux SUID sandbox cannot launch paths with spaces. See ADR 0019.
export const desktopPackageName = (platform: NodeJS.Platform) =>
  platform === "linux" ? "prompt-studio" : "Prompt Studio";

// Squirrel packs the Windows installer with NuGet 2, which accepts only SemVer 1 versions:
// a prerelease part without dots and with at most 20 characters. A nightly prerelease such as
// `nightly.20261026030503` is one character too long. NuGet compares prerelease parts as text,
// so cutting the end of the timestamp keeps nightlies in order. The app keeps its full version.
export const windowsPackageVersion = (version: string) => {
  const [release, ...prerelease] = version.split("-");
  if (!prerelease.length) return release!;
  return `${release}-${prerelease.join("-").replaceAll(".", "").slice(0, 20)}`;
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
