export interface ExtensionPackageDependencies {
  name: string;
  dir: string;
  isExtension: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export const checkExtensionRegistryResolution = (
  pkg: ExtensionPackageDependencies,
  lockPackages: Record<string, unknown[]>,
  errors: string[],
) => {
  if (!pkg.isExtension) return;
  for (const dependency of ["@pstdio/sdk", "@pstdio/ui"]) {
    if (!(dependency in pkg.dependencies) && !(dependency in pkg.devDependencies)) continue;
    const resolved = lockPackages[`${pkg.name}/${dependency}`]?.[0];
    // The root entries belong to the SDK/UI workspaces. Registry consumers have scoped entries.
    if (
      typeof resolved !== "string" ||
      !resolved.startsWith(`${dependency}@`) ||
      !/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(resolved.slice(dependency.length + 1))
    ) {
      errors.push(
        `${pkg.dir}: ${dependency} resolves to the workspace package; extensions must use the published package`,
      );
    }
  }
};
