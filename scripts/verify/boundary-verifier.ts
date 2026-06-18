import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DEFAULT_BOUNDARY_CONFIG } from "./boundary-config";
import { collectSourceFiles, collectSpecifiers, type ImportedSpecifier, normalizePath } from "./source-scanner";

const DEFAULT_ROOT = path.resolve(import.meta.dir, "../..");

export interface DeniedContent {
  label: string;
  pattern: RegExp;
}

export interface ContentDenylistRule {
  deniedContent: DeniedContent[];
  label: string;
  packageName: string;
  allowlist?: string[];
  pathPrefixes?: string[];
}

export interface SpecifierDenylistRule {
  forbiddenSpecifiers: string[];
  packageName: string;
  allowTypeOnlySpecifiers?: string[];
  allowlist?: string[];
  pathPrefixes?: string[];
}

export interface BoundaryConfig {
  allowedWorkspaceDeps: Record<string, string[]>;
  contentDenylistRules: ContentDenylistRule[];
  extensionAllowedDeps: string[];
  forbiddenSpecifiers: Record<string, string[]>;
  fixtureSourceFiles: string[];
  packageLayers: Record<string, number>;
  relativeEscapeAllowlist: string[];
  specifierDenylistRules: SpecifierDenylistRule[];
  extensionLayer?: number;
}

interface WorkspacePackage {
  name: string;
  dir: string;
  declared: Set<string>;
  isExtension: boolean;
}

interface VerifyInput {
  config?: BoundaryConfig;
  root?: string;
}

export interface BoundaryResult {
  errors: string[];
  packageCount: number;
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const pathMatches = (file: string, match: string) => {
  const normalized = normalizePath(match);
  if (file === normalized) return true;
  return normalized.endsWith("/") && file.startsWith(normalized);
};

const pathMatchesAny = (file: string, matches: string[] = []) => matches.some((match) => pathMatches(file, match));

const packagePathMatchesAny = (file: string, matches?: string[]) => {
  if (!matches || matches.length === 0) return true;
  return matches.some((match) => file === match || file.startsWith(`${match.replace(/\/$/, "")}/`));
};

const listDirs = (root: string, parent: string) => {
  const parentDir = path.join(root, parent);
  if (!statSync(parentDir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => path.join(parent, entry.name));
};

const discoverPackages = (root: string) => {
  const dirs = [
    ...listDirs(root, "packages"),
    ...listDirs(root, "extensions"),
    ...listDirs(root, "clients"),
    "scripts",
  ];
  const packages: WorkspacePackage[] = [];
  for (const dir of dirs) {
    const manifestPath = path.join(root, dir, "package.json");
    let manifest: { name?: string; [key: string]: unknown };
    try {
      manifest = readJson(manifestPath);
    } catch {
      continue;
    }
    if (!manifest.name) continue;
    const declared = new Set<string>();
    for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const dep of Object.keys((manifest[key] as Record<string, string>) ?? {})) declared.add(dep);
    }
    packages.push({
      name: manifest.name,
      dir: normalizePath(dir),
      declared,
      isExtension: dir.startsWith("extensions/"),
    });
  }
  return packages;
};

const packageNameOf = (specifier: string, workspaceNames: Set<string>) => {
  const parts = specifier.split("/");
  const candidates = specifier.startsWith("@") ? [parts.slice(0, 2).join("/")] : [parts[0]];
  return candidates.find((candidate) => workspaceNames.has(candidate)) ?? null;
};

const matchesForbiddenSpecifier = (specifier: string, forbidden: string) =>
  specifier === forbidden ||
  specifier.startsWith(`${forbidden}/`) ||
  (forbidden.endsWith(":") && specifier.startsWith(forbidden));

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

const layerOf = (pkg: WorkspacePackage | undefined, config: BoundaryConfig) => {
  if (!pkg) return null;
  return config.packageLayers[pkg.name] ?? (pkg.isExtension ? (config.extensionLayer ?? null) : null);
};

const checkDeclaredDeps = (
  pkg: WorkspacePackage,
  context: { config: BoundaryConfig; packageByName: Map<string, WorkspacePackage>; workspaceNames: Set<string> },
  errors: string[],
) => {
  const { config, packageByName, workspaceNames } = context;
  const allowed = pkg.isExtension ? config.extensionAllowedDeps : config.allowedWorkspaceDeps[pkg.name];
  const importerLayer = layerOf(pkg, config);
  if (importerLayer === null) errors.push(`${pkg.dir}: package "${pkg.name}" is missing from the package layer index`);
  if (!allowed)
    errors.push(`${pkg.dir}: package "${pkg.name}" is missing from the allowed layer map in boundary-config.ts`);

  for (const dep of pkg.declared) {
    if (!workspaceNames.has(dep)) continue;
    const depLayer = layerOf(packageByName.get(dep), config);
    if (depLayer === null) errors.push(`${pkg.dir}: dependency "${dep}" is missing from the package layer index`);
    if (importerLayer !== null && depLayer !== null && depLayer >= importerLayer) {
      errors.push(
        `${pkg.dir}: declares workspace dependency "${dep}" from layer ${importerLayer} to same or higher layer ${depLayer}`,
      );
    }
    if (allowed && !allowed.includes(dep)) {
      errors.push(`${pkg.dir}: declares workspace dependency "${dep}" not allowed by the layer map`);
    }
  }

  for (const forbidden of config.forbiddenSpecifiers[pkg.name] ?? []) {
    if (!forbidden.endsWith(":") && pkg.declared.has(forbidden)) {
      errors.push(`${pkg.dir}: declares forbidden dependency "${forbidden}"`);
    }
  }
};

const checkDeniedContent = (
  source: string,
  context: { config: BoundaryConfig; packageRelativeFile: string; pkg: WorkspacePackage; relativeFile: string },
  errors: string[],
) => {
  const { config, packageRelativeFile, pkg, relativeFile } = context;
  for (const rule of config.contentDenylistRules) {
    if (rule.packageName !== pkg.name) continue;
    if (!packagePathMatchesAny(packageRelativeFile, rule.pathPrefixes)) continue;
    if (pathMatchesAny(relativeFile, rule.allowlist)) continue;
    for (const denied of rule.deniedContent) {
      denied.pattern.lastIndex = 0;
      if (denied.pattern.test(source)) {
        errors.push(`${relativeFile}: ${rule.label} contains denied "${denied.label}" content`);
      }
    }
  }
};

const checkPackageForbiddenSpecifiers = (
  imported: ImportedSpecifier,
  context: { config: BoundaryConfig; pkg: WorkspacePackage; relativeFile: string },
  errors: string[],
) => {
  const { config, pkg, relativeFile } = context;
  for (const banned of config.forbiddenSpecifiers[pkg.name] ?? []) {
    if (matchesForbiddenSpecifier(imported.specifier, banned)) {
      errors.push(`${relativeFile}: forbidden import "${imported.specifier}"`);
    }
  }
};

const checkSpecifierDenylistRules = (
  imported: ImportedSpecifier,
  context: { config: BoundaryConfig; packageRelativeFile: string; pkg: WorkspacePackage; relativeFile: string },
  errors: string[],
) => {
  const { config, packageRelativeFile, pkg, relativeFile } = context;
  for (const rule of config.specifierDenylistRules) {
    if (rule.packageName !== pkg.name) continue;
    if (!packagePathMatchesAny(packageRelativeFile, rule.pathPrefixes)) continue;
    if (pathMatchesAny(relativeFile, rule.allowlist)) continue;
    const allowedTypeOnly =
      imported.typeOnly &&
      (rule.allowTypeOnlySpecifiers ?? []).some((allowed) => matchesForbiddenSpecifier(imported.specifier, allowed));
    const denied = rule.forbiddenSpecifiers.some((forbidden) =>
      matchesForbiddenSpecifier(imported.specifier, forbidden),
    );
    if (!allowedTypeOnly && denied) errors.push(`${relativeFile}: forbidden import "${imported.specifier}"`);
  }
};

const checkRelativeImport = (
  specifier: string,
  context: { config: BoundaryConfig; file: string; pkgRoot: string; relativeFile: string },
  errors: string[],
) => {
  const { config, file, pkgRoot, relativeFile } = context;
  const resolved = path.resolve(path.dirname(file), specifier);
  const escapes = !resolved.startsWith(pkgRoot + path.sep) && resolved !== pkgRoot;
  if (escapes && !config.relativeEscapeAllowlist.includes(relativeFile)) {
    errors.push(`${relativeFile}: relative import escapes the package root ("${specifier}")`);
  }
};

const checkUndeclaredWorkspaceImport = (
  specifier: string,
  context: { pkg: WorkspacePackage; relativeFile: string; workspaceNames: Set<string> },
  errors: string[],
) => {
  const { pkg, relativeFile, workspaceNames } = context;
  const target = packageNameOf(specifier, workspaceNames);
  if (target && target !== pkg.name && !pkg.declared.has(target)) {
    errors.push(`${relativeFile}: imports undeclared workspace package "${target}" ("${specifier}")`);
  }
};

const checkSpecifier = (
  imported: ImportedSpecifier,
  context: {
    config: BoundaryConfig;
    file: string;
    packageRelativeFile: string;
    pkg: WorkspacePackage;
    pkgRoot: string;
    relativeFile: string;
    workspaceNames: Set<string>;
  },
  errors: string[],
) => {
  const { config, file, packageRelativeFile, pkg, pkgRoot, relativeFile, workspaceNames } = context;
  const { specifier } = imported;
  if (specifier.includes("clients/")) errors.push(`${relativeFile}: imports from clients/* ("${specifier}")`);
  checkPackageForbiddenSpecifiers(imported, { config, pkg, relativeFile }, errors);
  checkSpecifierDenylistRules(imported, { config, packageRelativeFile, pkg, relativeFile }, errors);

  if (specifier.startsWith(".")) {
    checkRelativeImport(specifier, { config, file, pkgRoot, relativeFile }, errors);
    return;
  }

  checkUndeclaredWorkspaceImport(specifier, { pkg, relativeFile, workspaceNames }, errors);
};

const checkSourceImports = (
  pkg: WorkspacePackage,
  root: string,
  config: BoundaryConfig,
  workspaceNames: Set<string>,
  errors: string[],
) => {
  const pkgRoot = path.join(root, pkg.dir);
  for (const file of collectSourceFiles(pkgRoot)) {
    const relativeFile = normalizePath(path.relative(root, file));
    if (config.fixtureSourceFiles.includes(relativeFile)) continue;
    const packageRelativeFile = normalizePath(path.relative(pkgRoot, file));
    const source = readFileSync(file, "utf8");
    checkDeniedContent(source, { config, packageRelativeFile, pkg, relativeFile }, errors);
    for (const imported of collectSpecifiers(file, source)) {
      checkSpecifier(
        imported,
        { config, pkg, pkgRoot, file, relativeFile, packageRelativeFile, workspaceNames },
        errors,
      );
    }
  }
};

export const verifyBoundaries = (input: VerifyInput = {}): BoundaryResult => {
  const root = input.root ?? DEFAULT_ROOT;
  const config = input.config ?? DEFAULT_BOUNDARY_CONFIG;
  const packages = discoverPackages(root);
  const workspaceNames = new Set(packages.map((pkg) => pkg.name));
  const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  const errors: string[] = [];

  for (const cycle of findCycles(packages)) errors.push(`package cycle: ${cycle}`);
  for (const pkg of packages) {
    checkDeclaredDeps(pkg, { config, packageByName, workspaceNames }, errors);
    checkSourceImports(pkg, root, config, workspaceNames, errors);
  }

  return { errors: [...new Set(errors)], packageCount: packages.length };
};

export const formatBoundaryResult = (result: BoundaryResult) => {
  if (result.errors.length === 0) return `Boundaries OK across ${result.packageCount} workspace packages.`;
  return [`Boundary violations (${result.errors.length}):`, ...result.errors.map((error) => `  - ${error}`)].join("\n");
};
