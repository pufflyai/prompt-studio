import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { cssModuleInputs } from "./css-module-inputs";
import { inspectCompilerConfiguration, type RevisionCompilerInput } from "./revision-compiler-inputs";
import { resolveAdditionalRevisionModule } from "./revision-module-inputs";

export { copyRevisionSource, hashRevisionSource } from "./revision-file-inputs";

import { collectRuntimeModulePaths, readRuntimeModuleImports } from "./runtime-source-snapshot";

const dependencies = (packagePath: string) => {
  const manifest = existsSync(join(packagePath, "package.json"))
    ? JSON.parse(readFileSync(join(packagePath, "package.json"), "utf8"))
    : {};
  return [
    ...new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]),
  ].sort();
};
const findDependency = (from: string, name: string | null) => {
  if (!name) return null;
  let current = from;
  while (true) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return { path: realpathSync(candidate), link: candidate };
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
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
const selectedEntries = (path: string, specifier: string, from: string) => {
  const manifest = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
  const subpath = specifier.slice(packageName(specifier).length);
  const key = subpath ? `.${subpath}` : ".";
  const entries = mappedTargets(manifest.exports, key)
    .map((target) => join(path, target))
    .filter((target) => !target.endsWith(".d.ts") && existsSync(target));
  try {
    entries.push(Bun.resolveSync(specifier, from));
  } catch {}
  return [...new Set(entries)].filter((entry) => {
    const rel = relative(path, entry);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
};
const inspectModule = (
  file: string,
  contents: Buffer,
  addDependency: (specifier: string, conservative?: boolean, from?: string) => void,
  includeOpaqueDependencies: () => void,
  includeAssets: () => void,
  readSource: (path: string) => Buffer,
) => {
  if (file.endsWith(".css")) {
    for (const specifier of cssModuleInputs(contents.toString())) addDependency(specifier);
    return;
  }
  if (/\.[jt]sx$/.test(file)) {
    addDependency("react/jsx-runtime");
    // Custom JSX configuration can introduce a different implicit runtime. Retain the
    // declared closure rather than guessing how an extended config resolves it.
    const customJsx = /@jsxImportSource\s+([^\s*]+)/.exec(contents.toString())?.[1];
    if (customJsx) {
      includeOpaqueDependencies();
      addDependency(`${customJsx}/jsx-runtime`);
      addDependency(`${customJsx}/jsx-dev-runtime`);
    }
  }
  if (/import\.meta|\b__dirname\b|\b__filename\b|\breadFile/.test(contents.toString())) includeAssets();
  if (
    /\bcreateRequire\b|import\.meta\.resolve|\brequire\s*\(\s*[^"'\s]|\bimport\s*\(\s*[^"'\s]/.test(contents.toString())
  )
    includeOpaqueDependencies();
  try {
    for (const specifier of readRuntimeModuleImports(file, readSource)) addDependency(specifier);
  } catch {}
};
const inspectEntries = (
  canonical: string,
  entries: string[],
  inspected: Set<string>,
  addDependency: (specifier: string, conservative?: boolean, from?: string) => void,
  includeOpaqueDependencies: (from?: string) => void,
  files: Set<string>,
  includeAssets: () => void,
  readSource: (path: string) => Buffer,
  configuredDirectories: Set<string>,
  compilerInputs: Map<string, RevisionCompilerInput>,
) => {
  const modulePaths = new Set<string>();
  for (const entry of entries) {
    if (inspected.has(entry)) continue;
    for (const rel of collectRuntimeModulePaths(canonical, entry, readSource, files)) {
      files.add(rel);
      modulePaths.add(rel);
    }
  }
  for (const rel of modulePaths) {
    files.add(rel);
    if (rel !== "package.json" && !/\.[cm]?[jt]sx?$/.test(rel)) includeAssets();
    const file = join(canonical, rel);
    if (inspected.has(file) || !/\.(?:[cm]?[jt]sx?|css)$/.test(rel)) continue;
    inspected.add(file);
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
    inspectModule(
      file,
      contents,
      (specifier) => addDependency(specifier, false, dirname(file)),
      () => includeOpaqueDependencies(dirname(file)),
      includeAssets,
      readSource,
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
) => {
  if (additional.owner !== canonical)
    record.moduleInputs.set(`${relative(canonical, from)}:${specifier}`, additional.owner);
  if (additional.owner !== canonical || !record.files.has(relative(canonical, additional.file)))
    visit(additional.owner, [additional.file], conservative);
};
export const collectRevisionDependencies = (
  packagePath: string,
  options: { entryPath?: string; entryPaths?: string[] } = {},
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
  const configuredDirectories = new Set<string>();
  const opaque = new Set<string>();
  const resolvedImports = new Set<string>();
  const root = realpathSync(packagePath);
  const visit = (path: string, entries: string[], conservative = false) => {
    const canonical = realpathSync(path);
    const record = packages.get(canonical) ?? {
      path: canonical,
      dependencies: new Map<string, string>(),
      moduleInputs: new Map<string, string>(),
      bindings: new Map<string, string>(),
      files: new Set<string>(),
      allFiles: false,
    };
    packages.set(canonical, record);
    const addAlias = (specifier: string, conservative: boolean): void => {
      const imports = JSON.parse(readFileSync(join(canonical, "package.json"), "utf8")).imports;
      const targets = mappedTargets(imports, specifier);
      for (const target of targets) {
        addDependency(target, conservative);
      }
    };
    const addDependency = (specifier: string, conservative = false, from = canonical): void => {
      const importKey = `${canonical}\0${from}\0${specifier}\0${conservative}`;
      if (resolvedImports.has(importKey)) return;
      resolvedImports.add(importKey);
      if (specifier.startsWith("#")) addAlias(specifier, conservative);
      const name = dependencyName(specifier);
      const binding = findDependency(from, name);
      const resolved = binding?.path;
      const additional = resolveAdditionalRevisionModule(specifier, from, canonical, root, resolved);
      if (additional) {
        admitModuleInput(record, canonical, from, specifier, additional, conservative, visit);
        // Temporary compiled Bun resolution ambiguity: retain the physical binding too.
        // ADR 0145 records the conflicting-package reproduction and removal condition.
      }
      if (!name) return;
      record.dependencies.set(`${relative(canonical, from)}:${name}`, resolved ?? "missing");
      if (binding) record.bindings.set(binding.link, binding.path);
      if (resolved) visit(resolved, selectedEntries(resolved, specifier, from), conservative);
    };
    const includeDeclaredDependencies = (all: boolean, from: string) => {
      const key = `${canonical}:${from}:${all}`;
      if (opaque.has(key)) return;
      opaque.add(key);
      if (all) record.allFiles = true;
      for (const name of dependencies(canonical)) addDependency(name, all, from);
    };
    const includeOpaqueDependencies = (from = canonical) => includeDeclaredDependencies(true, from);
    // Browser builds may replace a worker-resolved entry or one of its imports.
    // Trace every replacement and its graph alongside the ordinary resolution.
    const manifest = existsSync(join(canonical, "package.json"))
      ? JSON.parse(readSource(join(canonical, "package.json")).toString())
      : {};
    entries = browserEntries(canonical, manifest, entries, addDependency, includeOpaqueDependencies, conservative);
    if (conservative || !entries.length) includeOpaqueDependencies();
    inspectEntries(
      canonical,
      entries,
      inspected,
      addDependency,
      includeOpaqueDependencies,
      record.files,
      () => {
        record.allFiles = true;
      },
      readSource,
      configuredDirectories,
      packages.compilerInputs,
    );
  };
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
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
export { copyRevisionDependencies, hashRevisionDependencies } from "./revision-dependency-artifacts";
