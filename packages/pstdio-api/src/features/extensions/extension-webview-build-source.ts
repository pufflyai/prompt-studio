import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

type PackageJson = {
  dependencies?: Record<string, unknown>;
  name?: string;
  peerDependencies?: Record<string, unknown>;
  [key: string]: unknown;
};

type ManagedWebviewBuildSourceInput = {
  entryPath: string;
  installName: string;
  packageName: string;
  packagePath: string;
};

type PrepareManagedWebviewBuildSourceInput = ManagedWebviewBuildSourceInput & {
  buildInputs?: ManagedWebviewBuildInputs;
  shellDir: string;
};

export type ManagedWebviewBuildInputs = {
  dependencyNames: string[];
  dependencyNodeModules: string | null;
  missingDependencies: string[];
  signature: string;
};

export type ManagedWebviewBuildSourceResult =
  | { entryPath: string; success: true }
  | { details: string; success: false };

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readPackageJson = (packagePath: string): PackageJson => {
  const parsed = JSON.parse(readFileSync(join(packagePath, "package.json"), "utf8")) as unknown;
  if (!isRecord(parsed)) return {};
  return parsed as PackageJson;
};

const declaredDependencyNames = (manifest: PackageJson) =>
  [...new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})])].sort();

const packageNameForImport = (importPath: string) => {
  if (
    importPath.startsWith(".") ||
    importPath.startsWith("/") ||
    importPath.startsWith("#") ||
    importPath.includes(":")
  ) {
    return null;
  }

  const parts = importPath.split("/");
  return importPath.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

const packagePathInNodeModules = (nodeModulesPath: string, packageName: string) => {
  const [scope, name] = packageName.split("/");
  if (packageName.startsWith("@") && name) return join(nodeModulesPath, scope, name);
  return join(nodeModulesPath, packageName);
};

const missingDependenciesIn = (nodeModulesPath: string, dependencyNames: string[]) =>
  dependencyNames.filter((name) => !existsSync(packagePathInNodeModules(nodeModulesPath, name)));

const hasUsableNodeModules = (nodeModulesPath: string, dependencyNames: string[]) =>
  existsSync(nodeModulesPath) && missingDependenciesIn(nodeModulesPath, dependencyNames).length === 0;

const candidateSourceRoots = (installName: string, packageName: string) => {
  const names = [...new Set([installName, packageName])];
  const repoRoots = [process.cwd(), resolve(import.meta.dirname, "../../../../../")];
  return repoRoots.flatMap((root) => names.map((name) => join(root, "extensions", name)));
};

const packageNameMatches = (packagePath: string, packageName: string) => {
  try {
    return readPackageJson(packagePath).name === packageName;
  } catch {
    return false;
  }
};

const resolveFallbackDependencyNodeModules = (
  packagePath: string,
  installName: string,
  packageName: string,
  dependencyNames: string[],
) => {
  for (const candidate of candidateSourceRoots(installName, packageName)) {
    if (resolve(candidate) === resolve(packagePath)) continue;
    if (!packageNameMatches(candidate, packageName)) continue;

    const candidateNodeModules = join(candidate, "node_modules");
    if (hasUsableNodeModules(candidateNodeModules, dependencyNames)) return candidateNodeModules;
  }

  return null;
};

const resolveLocalImport = (importerPath: string, importPath: string) => {
  if (!importPath.startsWith(".")) return null;

  const unresolvedPath = resolve(dirname(importerPath), importPath);
  const candidates = [
    unresolvedPath,
    ...sourceExtensions.map((extension) => `${unresolvedPath}${extension}`),
    ...sourceExtensions.map((extension) => join(unresolvedPath, `index${extension}`)),
  ];
  return candidates.find((candidate) => statSync(candidate, { throwIfNoEntry: false })?.isFile()) ?? null;
};

const transpilerLoader = (filePath: string) => {
  const extension = extname(filePath);
  if (extension === ".tsx") return "tsx" as const;
  if (extension === ".jsx") return "jsx" as const;
  if (extension === ".ts") return "ts" as const;
  return "js" as const;
};

const normalizedRelativePath = (rootPath: string, filePath: string) =>
  relative(rootPath, filePath).replaceAll("\\", "/");

const addHashEntry = (hash: ReturnType<typeof createHash>, path: string, content: string | Buffer) => {
  hash.update(path.replaceAll("\\", "/"));
  hash.update("\0");
  hash.update(content);
  hash.update("\0");
};

const inspectLocalImportGraph = (packagePath: string, entryPath: string) => {
  const hash = createHash("sha256");
  const pending = [entryPath];
  const packageImports = new Set<string>();
  const visited = new Set<string>();

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!filePath || visited.has(filePath)) continue;
    visited.add(filePath);

    const content = readFileSync(filePath);
    addHashEntry(hash, normalizedRelativePath(packagePath, filePath), content);
    if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extname(filePath))) continue;
    if ([".tsx", ".jsx"].includes(extname(filePath))) packageImports.add("react");

    try {
      const imports = new Bun.Transpiler({
        loader: transpilerLoader(filePath),
      }).scanImports(content);
      for (const imported of imports) {
        const resolvedPath = resolveLocalImport(filePath, imported.path);
        if (resolvedPath) {
          pending.push(resolvedPath);
          continue;
        }

        const packageName = packageNameForImport(imported.path);
        if (packageName) packageImports.add(packageName);
      }
    } catch {
      // Bun will surface source parse diagnostics during the actual build.
    }
  }

  return { packageImports, signature: hash.digest("hex") };
};

const addOptionalFile = (hash: ReturnType<typeof createHash>, path: string, filePath: string) =>
  addHashEntry(hash, path, existsSync(filePath) ? readFileSync(filePath) : "missing");

const buildInputSignature = (
  manifest: PackageJson,
  dependencyNames: string[],
  dependencyNodeModules: string | null,
  missingDependencies: string[],
  sourceGraphSignature: string,
) => {
  const hash = createHash("sha256");
  const { dependencies: _dependencies, peerDependencies: _peerDependencies, ...packageConfiguration } = manifest;
  addHashEntry(hash, "package.json", JSON.stringify(packageConfiguration));
  addHashEntry(hash, "source-graph", sourceGraphSignature);
  addHashEntry(hash, "dependency-node-modules", dependencyNodeModules ? "available" : "missing");
  addHashEntry(hash, "missing-dependencies", missingDependencies.join("\0"));

  for (const dependencyName of dependencyNames) {
    addHashEntry(hash, "dependency", dependencyName);
    if (!dependencyNodeModules) continue;
    addOptionalFile(
      hash,
      `node_modules/${dependencyName}/package.json`,
      join(packagePathInNodeModules(dependencyNodeModules, dependencyName), "package.json"),
    );
  }

  return hash.digest("hex");
};

export const inspectManagedWebviewBuildInputs = (input: ManagedWebviewBuildSourceInput): ManagedWebviewBuildInputs => {
  const manifest = readPackageJson(input.packagePath);
  const { packageImports, signature: sourceGraphSignature } = inspectLocalImportGraph(
    input.packagePath,
    input.entryPath,
  );
  const dependencyNames = declaredDependencyNames(manifest).filter((name) => packageImports.has(name));
  const packageNodeModules = join(input.packagePath, "node_modules");
  const packageMissingDependencies = missingDependenciesIn(packageNodeModules, dependencyNames);
  let dependencyNodeModules: string | null = null;

  if (dependencyNames.length === 0 || packageMissingDependencies.length === 0) {
    dependencyNodeModules = packageNodeModules;
  } else {
    dependencyNodeModules = resolveFallbackDependencyNodeModules(
      input.packagePath,
      input.installName,
      input.packageName,
      dependencyNames,
    );
  }

  const missingDependencies = dependencyNodeModules ? [] : packageMissingDependencies;

  return {
    dependencyNames,
    dependencyNodeModules,
    missingDependencies,
    signature: buildInputSignature(
      manifest,
      dependencyNames,
      dependencyNodeModules,
      missingDependencies,
      sourceGraphSignature,
    ),
  };
};

const symlinkPackageChild = (sourcePath: string, targetPath: string) => {
  const stats = lstatSync(sourcePath);
  symlinkSync(sourcePath, targetPath, stats.isDirectory() ? "junction" : "file");
};

const mirrorPackageSource = (packagePath: string, shellDir: string) => {
  mkdirSync(shellDir, { recursive: true });
  for (const dirent of readdirSync(packagePath, { withFileTypes: true })) {
    if (dirent.name === "node_modules") continue;
    cpSync(join(packagePath, dirent.name), join(shellDir, dirent.name), {
      recursive: true,
    });
  }
};

export const prepareManagedWebviewBuildSource = (
  input: PrepareManagedWebviewBuildSourceInput,
): ManagedWebviewBuildSourceResult => {
  const buildInputs = input.buildInputs ?? inspectManagedWebviewBuildInputs(input);
  if (buildInputs.missingDependencies.length > 0) {
    return {
      details: `Missing extension webview dependencies: ${buildInputs.missingDependencies.join(", ")}. Run \`bun install\` in ${input.packagePath}.`,
      success: false,
    };
  }

  const packageNodeModules = join(input.packagePath, "node_modules");
  if (buildInputs.dependencyNames.length === 0 || buildInputs.dependencyNodeModules === packageNodeModules) {
    return { entryPath: input.entryPath, success: true };
  }

  const stagingDir = `${input.shellDir}.staging-${crypto.randomUUID()}`;
  rmSync(stagingDir, { recursive: true, force: true });
  try {
    mirrorPackageSource(input.packagePath, stagingDir);
    if (buildInputs.dependencyNodeModules) {
      symlinkPackageChild(buildInputs.dependencyNodeModules, join(stagingDir, "node_modules"));
    }
    rmSync(input.shellDir, { recursive: true, force: true });
    renameSync(stagingDir, input.shellDir);
  } catch (error) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }

  return {
    entryPath: join(input.shellDir, relative(input.packagePath, input.entryPath)),
    success: true,
  };
};
