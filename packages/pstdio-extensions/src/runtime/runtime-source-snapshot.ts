import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

const moduleExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const executableExtensions = new Set(moduleExtensions.filter((extension) => extension !== ".json"));

const packageRelativePath = (packagePath: string, filePath: string) =>
  relative(packagePath, filePath).replaceAll("\\", "/");

const isInside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const resolveLocalImport = (importerPath: string, importPath: string) => {
  if (!importPath.startsWith(".")) return null;

  const unresolvedPath = resolve(dirname(importerPath), importPath);
  const candidates = [
    unresolvedPath,
    ...moduleExtensions.map((extension) => `${unresolvedPath}${extension}`),
    ...moduleExtensions.map((extension) => join(unresolvedPath, `index${extension}`)),
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

export const collectRuntimeModulePaths = (packagePath: string, entryPath: string) => {
  const pending = [entryPath];
  const modulePaths = new Set<string>();
  const packageJsonPath = join(packagePath, "package.json");
  if (existsSync(packageJsonPath)) modulePaths.add("package.json");

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!filePath || !isInside(packagePath, filePath)) continue;

    const relativePath = packageRelativePath(packagePath, filePath);
    if (modulePaths.has(relativePath)) continue;
    modulePaths.add(relativePath);
    if (!executableExtensions.has(extname(filePath))) continue;

    try {
      const imports = new Bun.Transpiler({ loader: transpilerLoader(filePath) }).scanImports(readFileSync(filePath));
      for (const imported of imports) {
        const resolvedPath = resolveLocalImport(filePath, imported.path);
        if (resolvedPath) pending.push(resolvedPath);
      }
    } catch {
      // Bun surfaces source parse diagnostics when the runtime imports the entry.
    }
  }

  return modulePaths;
};

export const hashRuntimeModulePaths = (packagePath: string, modulePaths: Set<string>) => {
  const hash = createHash("sha256");
  for (const relativePath of [...modulePaths].sort()) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(readFileSync(join(packagePath, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
};

const symlinkPackageChild = (sourcePath: string, targetPath: string) => {
  const stats = lstatSync(sourcePath);
  symlinkSync(sourcePath, targetPath, stats.isDirectory() ? "junction" : "file");
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
        symlinkPackageChild(sourceChild, targetChild);
      }
    }
  };

  mirrorDirectory(packagePath, targetPath);
};
