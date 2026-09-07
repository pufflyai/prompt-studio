import { join } from "node:path";

// The Linux SUID sandbox cannot launch paths with spaces. See ADR 0019.
export const desktopPackageName = (platform: NodeJS.Platform) =>
  platform === "linux" ? "prompt-studio" : "Prompt Studio";

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
