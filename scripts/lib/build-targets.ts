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
