type BuildTarget = {
  target: string;
  pkg: string;
  bin: string;
};

export const resolveBuildTargets = (
  buildTargets: BuildTarget[],
  packageOverride = process.env.PSTDIO_BUILD_PLATFORM_PKG,
) => {
  if (!packageOverride) return buildTargets;

  const buildTarget = buildTargets.find((target) => target.pkg === packageOverride);
  if (!buildTarget) {
    throw new Error(`No compiled build target is configured for PSTDIO_BUILD_PLATFORM_PKG=${packageOverride}`);
  }

  return [buildTarget];
};

// The release pipeline builds the Apple Silicon sidecar on a Mac. Emit JavaScriptCore
// bytecode there so the CLI and its workers can load compiled modules on every launch.
export const nativeMacBytecodeFlags = (target: string) =>
  target === "bun-darwin-arm64" && process.platform === "darwin" && process.arch === "arm64"
    ? ["--bytecode", "--format=esm"]
    : [];
