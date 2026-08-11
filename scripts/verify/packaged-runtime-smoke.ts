type PlatformPackage = {
  pkg: string;
};

export const resolvePackagedRuntimeTestArgs = (platformPackage: PlatformPackage) => {
  if (!platformPackage.pkg.startsWith("cli-win-")) return ["run", "test:packaged"];

  return ["test", "src/packaged/runtime-lifecycle.test.ts", "--timeout", "30000", "--silent"];
};
