type PlatformPackage = {
  pkg: string;
};

export const shouldRunPackagedRuntimeSmoke = (platformPackage: PlatformPackage) =>
  !platformPackage.pkg.startsWith("cli-win-");
