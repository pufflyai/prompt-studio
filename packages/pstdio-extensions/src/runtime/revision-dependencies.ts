import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { inspectCompilerConfiguration, type RevisionCompilerInput } from "./revision-compiler-inputs";
import { resolveRevisionModule } from "./revision-module-inputs";
import { inspectRevisionModule } from "./revision-module-inspection";

export { copyRevisionSource, hashRevisionSource } from "./revision-file-inputs";

import { collectRuntimeModulePaths } from "./runtime-source-snapshot";

const dependencies = (manifest: {
  dependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
}) => {
  return [
    ...new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]),
  ].sort();
};
// Hash and copy the same dependency closure. A package's version or directory timestamp cannot
// establish its identity: local edits and package-manager replacements may preserve both.
const packageName = (specifier: string) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]!;
const exportTargets = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value)
    .filter(([key]) => key !== "types")
    .flatMap(([, target]) => exportTargets(target));
};
const mappedTargets = (mapping: unknown, key: string) => {
  const exports = mapping;
  let selected = exports;
  let wildcard: string | undefined;
  if (
    exports &&
    typeof exports === "object" &&
    Object.keys(exports).some((entry) => entry.startsWith(".") || entry.startsWith("#"))
  ) {
    selected = (exports as Record<string, unknown>)[key];
    if (!selected)
      for (const [pattern, value] of Object.entries(exports).sort(
        ([a], [b]) => b.indexOf("*") - a.indexOf("*") || b.length - a.length,
      )) {
        if (!pattern.includes("*")) continue;
        const [prefix, suffix = ""] = pattern.split("*");
        if (key.startsWith(prefix!) && key.endsWith(suffix)) {
          wildcard = key.slice(prefix!.length, key.length - suffix.length);
          selected = value;
          break;
        }
      }
  }
  return exportTargets(selected).map((target) => (wildcard === undefined ? target : target.replaceAll("*", wildcard)));
};
const selectedEntries = (
  path: string,
  specifier: string,
  resolvedFile: string | undefined,
  manifest: { exports?: unknown },
) => {
  const subpath = specifier.slice(packageName(specifier).length);
  const key = subpath ? `.${subpath}` : ".";
  const entries = mappedTargets(manifest.exports, key)
    .map((target) => join(path, target))
    .filter((target) => !target.endsWith(".d.ts") && existsSync(target));
  if (resolvedFile) entries.push(resolvedFile);
  return [...new Set(entries)].filter((entry) => {
    const rel = relative(path, entry);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
};
const inspectEntries = (
  canonical: string,
  entries: string[],
  inspected: Set<string>,
  addDependency: (specifier: string, conservative?: boolean, from?: string, macro?: boolean) => void,
  includeOpaqueDependencies: (from?: string) => void,
  files: Set<string>,
  includeAssets: () => void,
  readSource: (path: string) => Buffer,
  configuredDirectories: Set<string>,
  compilerInputs: Map<string, RevisionCompilerInput>,
  browser: boolean,
  knownPaths: Set<string>,
  context: string,
) => {
  const modulePaths = new Set<string>();
  for (const entry of entries) {
    if (inspected.has(`${context}:${entry}`)) continue;
    for (const rel of collectRuntimeModulePaths(canonical, entry, readSource, knownPaths)) {
      files.add(rel);
      knownPaths.add(rel);
      modulePaths.add(rel);
    }
  }
  for (const rel of modulePaths) {
    files.add(rel);
    if (rel !== "package.json" && !/\.[cm]?[jt]sx?$/.test(rel)) includeAssets();
    const file = join(canonical, rel);
    if (inspected.has(`${context}:${file}`) || !/\.(?:[cm]?[jt]sx?|css)$/.test(rel)) continue;
    inspected.add(`${context}:${file}`);
    inspectCompilerConfiguration(
      canonical,
      file,
      files,
      configuredDirectories,
      compilerInputs,
      includeOpaqueDependencies,
      readSource,
      (specifier) => addDependency(specifier, false, dirname(file)),
    );
    const contents = readSource(file);
    inspectRevisionModule(
      file,
      contents,
      (specifier, macro) => addDependency(specifier, macro, dirname(file), macro),
      () => includeOpaqueDependencies(dirname(file)),
      includeAssets,
      readSource,
      browser,
    );
  }
};
const browserEntries = (
  canonical: string,
  manifest: { browser?: string | Record<string, unknown> },
  entries: string[],
  addDependency: (specifier: string, conservative?: boolean) => void,
  includeOpaqueDependencies: () => void,
  conservative: boolean,
) => {
  const browser = typeof manifest.browser === "string" ? [manifest.browser] : Object.values(manifest.browser ?? {});
  for (const target of browser) {
    if (typeof target !== "string") continue;
    try {
      entries = [...entries, Bun.resolveSync(join(canonical, target), canonical)];
    } catch {
      if (target.startsWith(".")) includeOpaqueDependencies();
      else addDependency(target, conservative);
    }
  }
  return entries;
};
const isBareSpecifier = (specifier: string) =>
  !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("#") && !specifier.includes(":");
const dependencyName = (specifier: string) => (isBareSpecifier(specifier) ? packageName(specifier) : null);
const admitModuleInput = (
  record: { moduleInputs: Map<string, string>; files: Set<string> },
  canonical: string,
  from: string,
  specifier: string,
  additional: { owner: string; file: string },
  conservative: boolean,
  visit: (path: string, entries: string[], conservative?: boolean) => void,
  upgradeContext: boolean,
) => {
  if (additional.owner !== canonical)
    record.moduleInputs.set(`${relative(canonical, from)}:${specifier}`, additional.owner);
  if (upgradeContext || additional.owner !== canonical || !record.files.has(relative(canonical, additional.file)))
    visit(additional.owner, [additional.file], conservative);
};
export const collectRevisionDependencies = (
  packagePath: string,
  options: { entryPath?: string; entryPaths?: string[]; target?: "browser" } = {},
) => {
  const contents = new Map<string, Buffer>();
  const packages = Object.assign(
    new Map<
      string,
      {
        path: string;
        dependencies: Map<string, string>;
        moduleInputs: Map<string, string>;
        bindings: Map<string, string>;
        files: Set<string>;
        allFiles: boolean;
      }
    >(),
    { contents, compilerInputs: new Map<string, RevisionCompilerInput>() },
  );
  // Share bytes only within this inspection. Before/after preparation checks each create
  // a fresh reader, so filesystem edits never reuse an earlier operation's input snapshot.
  let cachedBytes = 0;
  const readSource = (path: string) => {
    let value = contents.get(path);
    if (!value) {
      value = readFileSync(path);
      if (cachedBytes + value.byteLength <= 64 * 1024 * 1024) {
        contents.set(path, value);
        cachedBytes += value.byteLength;
      }
    }
    return value;
  };
  const inspected = new Set<string>();
  const contextFiles = new Map<string, Set<string>>();
  // All memoized lookups belong to this inspection; the next source guard observes
  // package-manager replacements and changed manifests again.
  const manifests = new Map<string, ReturnType<typeof JSON.parse>>();
  const manifestFor = (path: string) => {
    if (!manifests.has(path)) {
      const file = join(path, "package.json");
      manifests.set(path, existsSync(file) ? JSON.parse(readSource(file).toString()) : {});
    }
    return manifests.get(path)!;
  };
  const bindings = new Map<string, { path: string; link: string } | null>();
  const findDependency = (from: string, name: string | null): { path: string; link: string } | null => {
    if (!name) return null;
    const key = `${from}\0${name}`;
    if (bindings.has(key)) return bindings.get(key)!;
    const candidate = join(from, "node_modules", name);
    const parent = dirname(from);
    let found: { path: string; link: string } | null = null;
    if (existsSync(join(candidate, "package.json"))) found = { path: realpathSync(candidate), link: candidate };
    else if (parent !== from) found = findDependency(parent, name);
    bindings.set(key, found);
    return found;
  };
  const configuredDirectories = new Map<string, Set<string>>();
  const opaque = new Set<string>();
  const resolvedImports = new Set<string>();
  const root = realpathSync(packagePath);
  const visit = (path: string, entries: string[], conservative = false, macro = false) => {
    // Roots, physical bindings and additional owners already have canonical paths.
    const canonical = path;
    const record = packages.get(canonical) ?? {
      path: canonical,
      dependencies: new Map<string, string>(),
      moduleInputs: new Map<string, string>(),
      bindings: new Map<string, string>(),
      files: new Set<string>(),
      allFiles: false,
    };
    packages.set(canonical, record);
    const addAlias = (specifier: string, conservative: boolean, macroContext: boolean): void => {
      const imports = manifestFor(canonical).imports;
      const targets = mappedTargets(imports, specifier);
      for (const target of targets) {
        addDependency(target, conservative, canonical, macroContext);
      }
    };
    const upgradeContext = (conservative: boolean, macro: boolean) =>
      macro || (options.target === "browser" && conservative);
    const inheritConservative = upgradeContext(conservative, macro);
    const addDependency = (
      specifier: string,
      conservativeImport = inheritConservative,
      from = canonical,
      macroContext = macro,
    ): void => {
      const importKey = `${canonical}\0${from}\0${specifier}\0${conservativeImport}\0${macroContext}`;
      if (resolvedImports.has(importKey)) return;
      resolvedImports.add(importKey);
      if (specifier.startsWith("#")) addAlias(specifier, conservativeImport, macroContext);
      const name = dependencyName(specifier);
      const binding = findDependency(from, name);
      const resolved = binding?.path;
      const additional = resolveRevisionModule(specifier, from, canonical, root, resolved);
      if (additional && additional.owner !== resolved) {
        admitModuleInput(
          record,
          canonical,
          from,
          specifier,
          additional,
          conservativeImport,
          (path, entries, conservative) => visit(path, entries, conservative, macroContext),
          upgradeContext(conservativeImport, macroContext),
        );
        // Temporary compiled Bun resolution ambiguity: retain the physical binding too.
        // ADR 0145 records the conflicting-package reproduction and removal condition.
      }
      if (!name) return;
      record.dependencies.set(`${relative(canonical, from)}:${name}`, resolved ?? "missing");
      if (binding) record.bindings.set(binding.link, binding.path);
      if (resolved)
        visit(
          resolved,
          selectedEntries(resolved, specifier, additional?.file, manifestFor(resolved)),
          conservativeImport,
          macroContext,
        );
    };
    const includeDeclaredDependencies = (all: boolean, from: string) => {
      const key = `${canonical}:${from}:${all}:${macro}`;
      if (opaque.has(key)) return;
      opaque.add(key);
      if (all) record.allFiles = true;
      for (const name of dependencies(manifestFor(canonical))) addDependency(name, all, from);
    };
    const includeOpaqueDependencies = (from = canonical) => includeDeclaredDependencies(true, from);
    // Browser builds may replace a worker-resolved entry or one of its imports.
    // Trace every replacement and its graph alongside the ordinary resolution.
    const manifest = manifestFor(canonical);
    entries = browserEntries(canonical, manifest, entries, addDependency, includeOpaqueDependencies, conservative);
    if (conservative || !entries.length) includeOpaqueDependencies();
    const browser = options.target === "browser" && !conservative && !macro;
    const context = `${browser}:${macro}`;
    const contextKey = `${context}:${canonical}`;
    if (!contextFiles.has(contextKey)) contextFiles.set(contextKey, new Set());
    if (!configuredDirectories.has(context)) configuredDirectories.set(context, new Set());
    inspectEntries(
      canonical,
      entries,
      inspected,
      (specifier, opaque, from, macroImport) =>
        addDependency(specifier, inheritConservative || opaque, from, macroImport || macro),
      includeOpaqueDependencies,
      record.files,
      () => {
        record.allFiles = true;
      },
      readSource,
      configuredDirectories.get(context)!,
      packages.compilerInputs,
      browser,
      contextFiles.get(contextKey)!,
      context,
    );
  };
  const manifest = manifestFor(root);
  const entries = options.entryPaths ?? [options.entryPath ?? join(root, manifest.main ?? "extension.ts")];
  visit(
    root,
    entries.filter((entry) => existsSync(entry)).map((entry) => realpathSync(entry)),
  );
  // Frontend callers hash the selected root graph too. Compiler configuration
  // participates even when it is not imported as a JavaScript module.
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    if (existsSync(join(root, name))) packages.get(root)!.files.add(name);
  }
  return packages;
};
export {
  copyRevisionDependencies,
  hashRevisionDependencies,
  hashRevisionDependenciesAsync,
} from "./revision-dependency-artifacts";
