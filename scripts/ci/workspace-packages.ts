import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Scope selection must work before installing Lerna or any package dependencies.
export const readWorkspacePackages = (root: string) => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const packages: Array<{ name: string; dir: string; dependencies: string[] }> = [];
  for (const pattern of manifest.workspaces as string[]) {
    const directories = pattern.endsWith("/*")
      ? readdirSync(join(root, pattern.slice(0, -2)), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => join(root, pattern.slice(0, -2), entry.name))
      : [join(root, pattern)];
    for (const directory of directories) {
      let content: string;
      try {
        content = readFileSync(join(directory, "package.json"), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      const pkg = JSON.parse(content);
      packages.push({
        name: pkg.name,
        dir: relative(root, directory).replaceAll("\\", "/"),
        dependencies: [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.devDependencies ?? {}),
          ...Object.keys(pkg.peerDependencies ?? {}),
          ...Object.keys(pkg.optionalDependencies ?? {}),
          ...(pkg.nx?.implicitDependencies ?? []),
        ],
      });
    }
  }
  return packages.sort((left, right) => left.name.localeCompare(right.name));
};
