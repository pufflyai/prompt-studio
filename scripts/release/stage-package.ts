import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const runtimeDependencies = (root: string, dependencies: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(dependencies).map(([name, range]) => {
      if (!range.startsWith("workspace:")) return [name, range];
      const dependency = JSON.parse(readFileSync(resolve(root, "node_modules", name, "package.json"), "utf8"));
      if (dependency.private) throw new Error(`Public package depends on private workspace package "${name}"`);
      const workspaceRange = range.slice("workspace:".length);
      const versionRange = workspaceRange === "*" ? dependency.version : workspaceRange;
      return [name, ["^", "~"].includes(versionRange) ? `${versionRange}${dependency.version}` : versionRange];
    }),
  );

export const stagePackage = (packageRoot: string) => {
  const root = resolve(packageRoot);
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const { devDependencies: _dev, scripts: _scripts, publishConfig, ...runtime } = manifest;
  const { directory: _directory, ...publication } = publishConfig ?? {};
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    if (runtime[field]) runtime[field] = runtimeDependencies(root, runtime[field]);
  }
  const destination = resolve(root, ".publish");
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  for (const path of runtime.files ?? []) {
    cpSync(resolve(root, path), resolve(destination, path), { recursive: true });
  }
  for (const path of ["README.md", "LICENSE", "LICENSE.md", "CHANGELOG.md"]) {
    if (existsSync(resolve(root, path))) cpSync(resolve(root, path), resolve(destination, path));
  }
  writeFileSync(
    resolve(destination, "package.json"),
    `${JSON.stringify({ ...runtime, publishConfig: publication }, null, 2)}\n`,
  );
  return destination;
};

if (import.meta.main) console.log(stagePackage(process.argv[2] ?? process.cwd()));
