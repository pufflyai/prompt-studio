/**
 * Repo-wide package boundary checks.
 *
 * Enforces the package layer map documented in
 * documentation/references/architecture/0013-package-boundaries.md:
 * - every workspace import must be declared in the importer's package.json
 * - workspace dependencies must stay within the allowed layer map below
 * - no dependency cycles among workspace packages
 * - no relative imports that escape a package root (packaging glue excepted)
 * - nothing imports from clients/*
 * - per-package content rules (e.g. @pstdio/ui owns no router/query policy)
 * - tsconfig paths stay inside the package or point at a declared dependency
 * - layer-map allowances match declared dependencies
 * - private packages keep their subpath exports under a limit
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseConfigFileTextToJson } from "typescript";
import {
  ALLOWED_WORKSPACE_DEPS,
  DEFAULT_PRIVATE_EXPORT_LIMIT,
  EXTENSION_ALLOWED_DEPS,
  FORBIDDEN_FOLDER_SPECIFIERS,
  FORBIDDEN_SPECIFIERS,
  PRIVATE_EXPORT_LIMITS,
  RELATIVE_ESCAPE_ALLOWLIST,
} from "./boundary-rules";
import { sourceImports } from "./source-imports";

const SKIP_DIRS = new Set(["node_modules", "dist", ".cache", "__test-tmp__", "_reference", "storybook-static"]);

interface WorkspacePackage {
  name: string;
  dir: string;
  declared: Set<string>;
  dependencies: Record<string, string>;
  isExtension: boolean;
  privateExports?: number;
}

interface Workspace {
  root: string;
  packages: WorkspacePackage[];
  names: Set<string>;
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const listDirs = (root: string, parent: string) =>
  readdirSync(path.join(root, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => `${parent}/${entry.name}`);

const discoverPackages = (root: string) => {
  const rootManifest = readJson(path.join(root, "package.json")) as { workspaces?: string[] };
  const dirs = (rootManifest.workspaces ?? []).flatMap((workspace) =>
    workspace.endsWith("/*") ? listDirs(root, workspace.slice(0, -2)) : [workspace],
  );
  const packages: WorkspacePackage[] = [];
  for (const dir of dirs) {
    const manifestPath = path.join(root, dir, "package.json");
    let manifest: { name?: string; version?: string; [key: string]: unknown };
    try {
      manifest = readJson(manifestPath);
    } catch {
      continue;
    }
    if (!manifest.name) continue;
    const dependencies = (manifest.dependencies as Record<string, string>) ?? {};
    const declared = new Set<string>();
    for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const dep of Object.keys((manifest[key] as Record<string, string>) ?? {})) declared.add(dep);
    }
    packages.push({
      name: manifest.name,
      dir,
      declared,
      dependencies,
      isExtension: Boolean((manifest.engines as { pstdio?: unknown } | undefined)?.pstdio),
      privateExports:
        manifest.private === true && typeof manifest.exports === "object" && manifest.exports
          ? Object.keys(manifest.exports).length
          : undefined,
    });
  }
  return packages;
};

const collectFiles = (dir: string, pattern: RegExp) => {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(current, entry.name));
        continue;
      }
      if (pattern.test(entry.name)) files.push(path.join(current, entry.name));
    }
  };
  if (statSync(dir, { throwIfNoEntry: false })?.isDirectory()) walk(dir);
  return files;
};

const packageNameOf = (specifier: string, workspaceNames: Set<string>) => {
  const parts = specifier.split("/");
  const candidates = specifier.startsWith("@") ? [parts.slice(0, 2).join("/")] : [parts[0]];
  return candidates.find((candidate) => workspaceNames.has(candidate)) ?? null;
};

const findCycles = (packages: WorkspacePackage[]) => {
  const names = new Set(packages.map((pkg) => pkg.name));
  const edges = new Map(packages.map((pkg) => [pkg.name, [...pkg.declared].filter((dep) => names.has(dep))]));
  const cycles: string[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (name: string, trail: string[]) => {
    if (done.has(name)) return;
    if (visiting.has(name)) {
      cycles.push([...trail.slice(trail.indexOf(name)), name].join(" -> "));
      return;
    }
    visiting.add(name);
    for (const dep of edges.get(name) ?? []) visit(dep, [...trail, name]);
    visiting.delete(name);
    done.add(name);
  };
  for (const pkg of packages) visit(pkg.name, []);
  return cycles;
};

const checkDeclaredDeps = (pkg: WorkspacePackage, workspaceNames: Set<string>, errors: string[]) => {
  const allowed = ALLOWED_WORKSPACE_DEPS[pkg.name] ?? (pkg.isExtension ? EXTENSION_ALLOWED_DEPS : undefined);
  if (!allowed) {
    errors.push(`${pkg.dir}: package "${pkg.name}" is missing from the allowed layer map in verify-boundaries.ts`);
    return;
  }
  for (const dep of pkg.declared) {
    if (workspaceNames.has(dep) && !allowed.includes(dep)) {
      errors.push(`${pkg.dir}: declares workspace dependency "${dep}" not allowed by the layer map`);
    }
  }
  for (const dep of ALLOWED_WORKSPACE_DEPS[pkg.name] ?? []) {
    if (!pkg.declared.has(dep)) {
      errors.push(`${pkg.dir}: layer map allows "${dep}" but the package does not declare it; remove the allowance`);
    }
  }
  const exportLimit = PRIVATE_EXPORT_LIMITS[pkg.name] ?? DEFAULT_PRIVATE_EXPORT_LIMIT;
  if (pkg.privateExports !== undefined && pkg.privateExports > exportLimit) {
    errors.push(`${pkg.dir}: private package exports ${pkg.privateExports} subpaths; the limit is ${exportLimit}`);
  }
  for (const forbidden of FORBIDDEN_SPECIFIERS[pkg.name] ?? []) {
    if (pkg.declared.has(forbidden)) {
      errors.push(`${pkg.dir}: declares forbidden dependency "${forbidden}"`);
    }
  }
};

const numericIdentifier = "(?:0|[1-9]\\d*)";
const prereleaseIdentifier = `(?:${numericIdentifier}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const exactVersion = new RegExp(
  `^${numericIdentifier}\\.${numericIdentifier}\\.${numericIdentifier}(?:-${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
);

export const checkExtensionUiVersion = (pkg: WorkspacePackage, errors: string[]) => {
  const declaredVersion = pkg.dependencies["@pstdio/ui"];
  if (pkg.isExtension && declaredVersion && !exactVersion.test(declaredVersion)) {
    errors.push(`${pkg.dir}: must pin @pstdio/ui to an exact published version instead of "${declaredVersion}"`);
  }
};

interface FileContext {
  pkg: WorkspacePackage;
  pkgRoot: string;
  file: string;
  relativeFile: string;
  workspace: Workspace;
}

const matchesPackage = (specifier: string, packages: string[]) =>
  packages.some((name) => specifier === name || specifier.startsWith(`${name}/`));

const isWithin = (dir: string, target: string) => target === dir || target.startsWith(dir + path.sep);

const checkSpecifier = (specifier: string, context: FileContext, errors: string[]) => {
  const { pkg, pkgRoot, file, relativeFile, workspace } = context;
  if (matchesPackage(specifier, FORBIDDEN_SPECIFIERS[pkg.name] ?? [])) {
    errors.push(`${relativeFile}: forbidden import "${specifier}"`);
  }
  const folderRule = FORBIDDEN_FOLDER_SPECIFIERS[pkg.name];
  if (
    folderRule &&
    isWithin(path.join(pkgRoot, folderRule.folder), file) &&
    matchesPackage(specifier, folderRule.specifiers)
  ) {
    errors.push(`${relativeFile}: ${folderRule.rule} "${specifier}"`);
  }
  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(file), specifier);
    if (!isWithin(pkgRoot, resolved) && !RELATIVE_ESCAPE_ALLOWLIST.includes(relativeFile)) {
      errors.push(`${relativeFile}: relative import escapes the package root ("${specifier}")`);
    }
    return;
  }
  const target = packageNameOf(specifier, workspace.names);
  if (!target || target === pkg.name) return;
  if (workspace.packages.find((candidate) => candidate.name === target)?.dir.startsWith("clients/")) {
    errors.push(`${relativeFile}: imports from clients/* ("${specifier}")`);
  }
  if (!pkg.declared.has(target)) {
    errors.push(`${relativeFile}: imports undeclared workspace package "${target}" ("${specifier}")`);
  }
};

const checkSourceImports = (pkg: WorkspacePackage, workspace: Workspace, errors: string[]) => {
  const pkgRoot = path.join(workspace.root, pkg.dir);
  for (const file of collectFiles(pkgRoot, /\.(ts|tsx)$/)) {
    const relativeFile = path.relative(workspace.root, file).replaceAll("\\", "/");
    const source = readFileSync(file, "utf8");
    if (
      (/^packages\/e2e\/src\/(?:ui|vite-terminal)\//.test(relativeFile) ||
        /^packages\/e2e\/playwright(?:\.vite-terminal)?\.config\.ts$/.test(relativeFile)) &&
      /E2E_(?:API|VITE_DEV|VITE_PREVIEW)_PORT|\blocalhost\b|\b127\.0\.0\.1\b|\[::1\]/.test(source)
    ) {
      errors.push(
        `${relativeFile}: use relative request URLs or import the suite origin from src/ui-server.ts or src/vite-terminal-servers.ts instead of defining a browser test address`,
      );
    }
    for (const specifier of sourceImports(source)) {
      checkSpecifier(specifier, { pkg, pkgRoot, file, relativeFile, workspace }, errors);
    }
  }
};

// A path alias outside the package bypasses package exports and, for extensions, the
// released SDK version they declare. Only declared non-extension workspace dependencies
// may be mapped to source (the SDK and workbench bundle their private dependencies).
const checkTsconfigPaths = (pkg: WorkspacePackage, workspace: Workspace, errors: string[]) => {
  const pkgRoot = path.join(workspace.root, pkg.dir);
  for (const file of collectFiles(pkgRoot, /^tsconfig.*\.json$/)) {
    const relativeFile = path.relative(workspace.root, file).replaceAll("\\", "/");
    const { config } = parseConfigFileTextToJson(file, readFileSync(file, "utf8"));
    const options = (config?.compilerOptions ?? {}) as { baseUrl?: string; paths?: Record<string, string[]> };
    const base = path.resolve(path.dirname(file), options.baseUrl ?? ".");
    for (const [alias, targets] of Object.entries(options.paths ?? {})) {
      for (const target of targets) {
        const resolved = path.resolve(base, target);
        if (isWithin(pkgRoot, resolved)) continue;
        const owner = workspace.packages.find((candidate) =>
          isWithin(path.join(workspace.root, candidate.dir), resolved),
        );
        if (!pkg.isExtension && owner && pkg.declared.has(owner.name)) continue;
        errors.push(`${relativeFile}: path "${alias}" resolves outside the package ("${target}")`);
      }
    }
  }
};

/** Returns every boundary violation in the workspace at `root`. */
export const verifyBoundaries = (root: string) => {
  const packages = discoverPackages(root);
  const workspace = { root, packages, names: new Set(packages.map((pkg) => pkg.name)) };
  const errors: string[] = [];

  for (const cycle of findCycles(packages)) {
    errors.push(`package cycle: ${cycle}`);
  }
  for (const pkg of packages) {
    checkDeclaredDeps(pkg, workspace.names, errors);
    checkExtensionUiVersion(pkg, errors);
    checkSourceImports(pkg, workspace, errors);
    checkTsconfigPaths(pkg, workspace, errors);
  }
  return [...new Set(errors)];
};

const main = () => {
  const root = path.resolve(import.meta.dir, "../..");
  const errors = verifyBoundaries(root);
  if (errors.length > 0) {
    console.error(`Boundary violations (${errors.length}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`Boundaries OK across ${discoverPackages(root).length} workspace packages.`);
};

if (import.meta.main) main();
