type PlatformPackage = {
  pkg: string;
};

export const resolvePackagedRuntimeTestArgs = (platformPackage: PlatformPackage) => {
  if (!platformPackage.pkg.startsWith("cli-win-")) return ["run", "test:packaged"];

  const tests = ["src/packaged/runtime-lifecycle.test.ts"];
  if (platformPackage.pkg === "cli-win-x64") tests.push("src/packaged/extension-browser-install.test.ts");
  return ["test", ...tests, "--timeout", "30000", "--silent"];
};
