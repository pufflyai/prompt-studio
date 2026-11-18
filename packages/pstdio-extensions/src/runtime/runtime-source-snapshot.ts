import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { cssModuleInputs } from "./css-module-inputs";
import { mirrorPackageChild } from "./mirror-package-child";

const moduleExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".mts", ".cts"];
const executableExtensions = new Set(moduleExtensions.filter((extension) => extension !== ".json"));

const packageRelativePath = (packagePath: string, filePath: string) =>
  relative(packagePath, filePath).replaceAll("\\", "/");

const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

// Importers in one graph commonly resolve the same relative module. Each inspection
// owns its lookups so the post-build guard sees new files and changed links.
export const createLocalImportResolver = (
  isFile = (path: string) => statSync(path, { throwIfNoEntry: false })?.isFile(),
) => {
  const paths = new Map<string, string | null>();
  const find = (path: string) => {
    if (isFile(path)) return path;
    for (const extension of moduleExtensions) if (isFile(path + extension)) return path + extension;
    const index = join(path, "index");
    for (const extension of moduleExtensions) if (isFile(index + extension)) return index + extension;
    return null;
  };
  return (importer: string, specifier: string) => {
    if (!specifier.startsWith(".") && extname(importer) !== ".css") return null;
    const path = resolve(dirname(importer), specifier);
    const previous = paths.get(path);
    if (previous !== undefined) return previous;
    const file = find(path);
    paths.set(path, file);
    return file;
  };
};

const transpilerLoader = (filePath: string) => {
  const extension = extname(filePath);
  if (extension === ".tsx") return "tsx" as const;
  if (extension === ".jsx") return "jsx" as const;
  if ([".ts", ".mts", ".cts"].includes(extension)) return "ts" as const;
  return "js" as const;
};

const transpilers = new Map<Bun.JavaScriptLoader, Bun.Transpiler>();
const importsByContent = new Map<string, string[]>();
const importsByBytes = new WeakMap<Buffer, { digest: string; imports: Map<string, string[]> }>();
const maxImportEntries = 12_288;
const maxImportHintBytes = 2 * 1024 * 1024;
export type RuntimeModuleImportHint = [key: string, imports: string[]];

const storeModuleImports = (key: string, imports: string[]) => {
  if (importsByContent.size >= maxImportEntries && !importsByContent.has(key))
    importsByContent.delete(importsByContent.keys().next().value!);
  importsByContent.set(key, imports);
};

const encodedImportHintBytes = (hint: RuntimeModuleImportHint) => Buffer.byteLength(JSON.stringify(hint)) + 1;

export const captureRuntimeModuleImportHints = () => {
  const hints: RuntimeModuleImportHint[] = [];
  let bytes = 2;
  for (const hint of importsByContent) {
    const length = encodedImportHintBytes(hint);
    if (bytes + length > maxImportHintBytes) break;
    bytes += length;
    hints.push(hint);
  }
  return hints;
};

const isImportHint = (hint: unknown): hint is RuntimeModuleImportHint =>
  Array.isArray(hint) &&
  hint.length === 2 &&
  typeof hint[0] === "string" &&
  /^(?:css|js|jsx|ts|tsx)\0(?:true|false)\0[0-9a-f]{64}$/.test(hint[0]) &&
  Array.isArray(hint[1]) &&
  hint[1].every((specifier) => typeof specifier === "string");

export const isRuntimeModuleImportHints = (value: unknown): value is RuntimeModuleImportHint[] => {
  if (!Array.isArray(value) || value.length > maxImportEntries) return false;
  let bytes = 2;
  for (const hint of value) {
    if (!isImportHint(hint)) return false;
    bytes += encodedImportHintBytes(hint);
    if (bytes > maxImportHintBytes) return false;
  }
  return true;
};

// Only parse results are reusable. Their keys include the loader, folding mode,
// and a digest of the fresh file bytes. Resolution remains local to the new guard.
export const restoreRuntimeModuleImportHints = (hints: RuntimeModuleImportHint[]) => {
  for (const [key, imports] of hints) storeModuleImports(key, imports);
};

export const readRuntimeModuleImports = (
  filePath: string,
  readSource: (path: string) => Buffer,
  foldConstants = false,
): string[] => {
  const contents = readSource(filePath);
  let bytes = importsByBytes.get(contents);
  if (!bytes) {
    bytes = { digest: createHash("sha256").update(contents).digest("hex"), imports: new Map() };
    importsByBytes.set(contents, bytes);
  }
  const loader = transpilerLoader(filePath);
  const mode = `${extname(filePath) === ".css" ? "css" : loader}\0${foldConstants}`;
  const inspected = bytes.imports.get(mode);
  if (inspected) return inspected;
  const cacheKey = `${mode}\0${bytes.digest}`;
  const cached = importsByContent.get(cacheKey);
  if (cached) {
    bytes.imports.set(mode, cached);
    return cached;
  }

  let transpiler = transpilers.get(loader);
  if (!transpiler) {
    transpiler = new Bun.Transpiler({ loader });
    transpilers.set(loader, transpiler);
  }

  // CSS regex captures can retain the whole stylesheet. Copy their UTF-16 code units before caching.
  const imports =
    extname(filePath) === ".css"
      ? cssModuleInputs(contents.toString()).map((path) => Buffer.from(path, "utf16le").toString("utf16le"))
      : [
          ...new Set([
            ...(foldConstants
              ? readRuntimeModuleImports(filePath, () => contents)
              : transpiler.scanImports(contents).map(({ path }) => path)),
            ...(foldConstants
              ? transpiler.scanImports(transpiler.transformSync(contents)).map(({ path }) => path)
              : []),
          ]),
        ];
  // Staged and installed copies share parsing, not filesystem identities. Fresh bytes
  // still validate every read, and graph/package resolution below remains uncached.
  // Bound retained parse results without retaining their source buffers.
  storeModuleImports(cacheKey, imports);
  bytes.imports.set(mode, imports);
  return imports;
};

export const collectRuntimeModulePaths = (
  packagePath: string,
  entryPath: string,
  readSource: (path: string) => Buffer = (path) => readFileSync(path),
  knownPaths: ReadonlySet<string> = new Set(),
  resolveLocalImport = createLocalImportResolver(),
) => {
  const pending = [entryPath];
  const modulePaths = new Set<string>();
  const packageJsonPath = join(packagePath, "package.json");
  if (existsSync(packageJsonPath)) modulePaths.add("package.json");

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!filePath || !isInside(packagePath, filePath)) continue;

    const relativePath = packageRelativePath(packagePath, filePath);
    if (modulePaths.has(relativePath) || knownPaths.has(relativePath)) continue;
    modulePaths.add(relativePath);
    if (!executableExtensions.has(extname(filePath))) continue;

    try {
      for (const importPath of readRuntimeModuleImports(filePath, readSource)) {
        const resolvedPath = resolveLocalImport(filePath, importPath);
        if (resolvedPath) pending.push(resolvedPath);
      }
    } catch {
      // Bun surfaces source parse diagnostics when the runtime imports the entry.
    }
  }

  return modulePaths;
};

const containsRuntimeModule = (relativePath: string, modulePaths: Set<string>) =>
  [...modulePaths].some((modulePath) => modulePath.startsWith(`${relativePath}/`));

export const mirrorRuntimeSourceSnapshot = (packagePath: string, targetPath: string, modulePaths: Set<string>) => {
  const mirrorDirectory = (sourceDir: string, targetDir: string) => {
    mkdirSync(targetDir, { recursive: true });

    for (const dirent of readdirSync(sourceDir, { withFileTypes: true })) {
      if (dirent.name === ".git" || dirent.name === "node_modules" || dirent.name.startsWith(".pstdio-runtime-")) {
        continue;
      }

      const sourceChild = join(sourceDir, dirent.name);
      const targetChild = join(targetDir, dirent.name);
      const relativePath = packageRelativePath(packagePath, sourceChild);

      if (dirent.isDirectory() && containsRuntimeModule(relativePath, modulePaths)) {
        mirrorDirectory(sourceChild, targetChild);
      } else if (dirent.isFile() && modulePaths.has(relativePath)) {
        copyFileSync(sourceChild, targetChild);
      } else {
        mirrorPackageChild(sourceChild, targetChild);
      }
    }
  };

  mirrorDirectory(packagePath, targetPath);
};
