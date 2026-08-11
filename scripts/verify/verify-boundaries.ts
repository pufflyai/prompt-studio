/**
 * Repo-wide package boundary checks.
 *
 * Enforces the package layer map documented in
 * .pstdio/docs/architecture/package-boundaries.md:
 * - every workspace import must be declared in the importer's package.json
 * - workspace dependencies must stay within the allowed layer map below
 * - no dependency cycles among workspace packages
 * - no relative imports that escape a package root (packaging glue excepted)
 * - nothing imports from clients/*
 * - per-package content rules (e.g. @pstdio/ui owns no router/query policy)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");

// Workspace-internal dependencies each package may declare. Additions here are
// intentional architecture changes — update the docs when this map changes.
const ALLOWED_WORKSPACE_DEPS: Record<string, string[]> = {
  "pstdio-api-contracts": [],
  "pstdio-file-types": [],
  "pstdio-paths": [],
  "pstdio-logging": ["pstdio-paths"],
  "pstdio-db": ["pstdio-paths"],
  "pstdio-scheduler": [],
  "pstdio-wt": ["pstdio-file-types"],
  "pstdio-storage": ["pstdio-api-contracts", "pstdio-db", "pstdio-paths"],
  "@pstdio/sdk": ["pstdio-api-contracts"],
  "pstdio-extensions": ["@pstdio/sdk", "pstdio-api-contracts", "pstdio-paths"],
  "pstdio-api-runtime-host": ["pstdio-api-contracts", "pstdio-extensions"],
  "pstdio-api": [
    "pstdio-api-contracts",
    "pstdio-api-runtime-host",
    "pstdio-db",
    "pstdio-extensions",
    "pstdio-logging",
    "pstdio-paths",
    "pstdio-scheduler",
    "pstdio-storage",
    "pstdio-wt",
  ],
  pstdio: [
    "@pstdio/sdk",
    "pstdio-api",
    "pstdio-api-contracts",
    "pstdio-dashboard",
    "pstdio-db",
    "pstdio-logging",
    "pstdio-paths",
    "pstdio-wt",
  ],
  "@pstdio/ui": ["pstdio-file-types"],
  "@pstdio/workbench": ["@pstdio/sdk", "@pstdio/ui", "pstdio-api-contracts", "pstdio-extensions"],
  "pstdio-dashboard": ["@pstdio/sdk", "@pstdio/ui", "pstdio-api-contracts", "pstdio-extensions", "@pstdio/workbench"],
  "pstdio-extension-testbench": ["@pstdio/sdk", "@pstdio/ui", "pstdio-extensions", "@pstdio/workbench"],
  e2e: ["pstdio", "pstdio-api-contracts", "pstdio-db", "pstdio-extensions", "pstdio-wt"],
  "pstdio-scripts": ["pstdio-extensions"],
  "@pstdio/desktop": ["@pstdio/ui", "pstdio", "pstdio-logging", "pstdio-paths"],
  "@pstdio/landing-page": ["@pstdio/ui"],
};

// Extensions may only consume the public authoring surface.
const EXTENSION_ALLOWED_DEPS = ["@pstdio/sdk", "@pstdio/ui"];

// Specifiers a package's sources must never reference or declare.
const FORBIDDEN_SPECIFIERS: Record<string, string[]> = {
  "@pstdio/ui": ["@tanstack/react-router", "@tanstack/react-query"],
};

// Generated packaging glue that intentionally reaches across package roots.
const RELATIVE_ESCAPE_ALLOWLIST = ["packages/pstdio/src/_embed-manifest.generated.ts"];

// Files whose template literals embed extension source code; the import scanner
// cannot tell those strings from real imports.
const FIXTURE_SOURCE_FILES = [
  "packages/e2e/src/packaged/extension-fixtures.ts",
  "packages/pstdio-api/src/features/extensions/install-extension-source-deps.test.ts",
];

const SKIP_DIRS = new Set(["node_modules", "dist", ".cache", "__test-tmp__", "_reference", "storybook-static"]);

interface WorkspacePackage {
  name: string;
  dir: string;
  declared: Set<string>;
  isExtension: boolean;
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

const listDirs = (parent: string) =>
  readdirSync(path.join(ROOT, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => path.join(parent, entry.name));

const discoverPackages = () => {
  const dirs = [...listDirs("packages"), ...listDirs("extensions"), ...listDirs("clients"), "scripts"];
  const packages: WorkspacePackage[] = [];
  for (const dir of dirs) {
    const manifestPath = path.join(ROOT, dir, "package.json");
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
    packages.push({ name: manifest.name, dir, declared, isExtension: dir.startsWith("extensions/") });
  }
  return packages;
};

const collectSourceFiles = (dir: string) => {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(path.join(current, entry.name));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name)) files.push(path.join(current, entry.name));
    }
  };
  if (statSync(dir, { throwIfNoEntry: false })?.isDirectory()) walk(dir);
  return files;
};

const IMPORT_PATTERN =
  /(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|import\s+["']([^"']+)["']/g;

const collectSpecifiers = (file: string) => {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
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
  const allowed = pkg.isExtension ? EXTENSION_ALLOWED_DEPS : ALLOWED_WORKSPACE_DEPS[pkg.name];
  if (!allowed) {
    errors.push(`${pkg.dir}: package "${pkg.name}" is missing from the allowed layer map in verify-boundaries.ts`);
    return;
  }
  for (const dep of pkg.declared) {
    if (workspaceNames.has(dep) && !allowed.includes(dep)) {
      errors.push(`${pkg.dir}: declares workspace dependency "${dep}" not allowed by the layer map`);
    }
  }
  for (const forbidden of FORBIDDEN_SPECIFIERS[pkg.name] ?? []) {
    if (pkg.declared.has(forbidden)) {
      errors.push(`${pkg.dir}: declares forbidden dependency "${forbidden}"`);
    }
  }
};

const checkSpecifier = (
  specifier: string,
  context: { pkg: WorkspacePackage; pkgRoot: string; file: string; relativeFile: string; workspaceNames: Set<string> },
  errors: string[],
) => {
  const { pkg, pkgRoot, file, relativeFile, workspaceNames } = context;
  if (specifier.includes("clients/")) {
    errors.push(`${relativeFile}: imports from clients/* ("${specifier}")`);
  }
  for (const banned of FORBIDDEN_SPECIFIERS[pkg.name] ?? []) {
    if (specifier === banned || specifier.startsWith(`${banned}/`)) {
      errors.push(`${relativeFile}: forbidden import "${specifier}"`);
    }
  }
  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(file), specifier);
    const escapes = !resolved.startsWith(pkgRoot + path.sep) && resolved !== pkgRoot;
    if (escapes && !RELATIVE_ESCAPE_ALLOWLIST.includes(relativeFile)) {
      errors.push(`${relativeFile}: relative import escapes the package root ("${specifier}")`);
    }
    return;
  }
  const target = packageNameOf(specifier, workspaceNames);
  if (target && target !== pkg.name && !pkg.declared.has(target)) {
    errors.push(`${relativeFile}: imports undeclared workspace package "${target}" ("${specifier}")`);
  }
};

const checkSourceImports = (pkg: WorkspacePackage, workspaceNames: Set<string>, errors: string[]) => {
  const pkgRoot = path.join(ROOT, pkg.dir);
  for (const file of collectSourceFiles(pkgRoot)) {
    const relativeFile = path.relative(ROOT, file);
    if (FIXTURE_SOURCE_FILES.includes(relativeFile)) continue;
    for (const specifier of collectSpecifiers(file)) {
      checkSpecifier(specifier, { pkg, pkgRoot, file, relativeFile, workspaceNames }, errors);
    }
  }
};

const main = () => {
  const packages = discoverPackages();
  const workspaceNames = new Set(packages.map((pkg) => pkg.name));
  const errors: string[] = [];

  for (const cycle of findCycles(packages)) {
    errors.push(`package cycle: ${cycle}`);
  }
  for (const pkg of packages) {
    checkDeclaredDeps(pkg, workspaceNames, errors);
    checkSourceImports(pkg, workspaceNames, errors);
  }

  if (errors.length > 0) {
    console.error(`Boundary violations (${errors.length}):`);
    for (const error of [...new Set(errors)]) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`Boundaries OK across ${packages.length} workspace packages.`);
};

main();
