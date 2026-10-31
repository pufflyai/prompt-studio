import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { CanvasEntry } from "./manifest";

const PROJECT_FILES = ["package.json", "bun.lock", "bun.lockb", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
const toPosix = (path: string) => path.split(sep).join("/");
const inNodeModules = (path: string) => toPosix(path).split("/").includes("node_modules");

/** Files inside the root are stored relative to it; others, such as sibling workspace packages, absolutely. */
export const inputKey = (root: string, file: string) => {
  const path = toPosix(relative(root, file));
  return path.startsWith("../") || isAbsolute(path) ? toPosix(file) : path;
};
export const inputPath = (root: string, key: string) => (isAbsolute(key) ? key : join(root, key));

// `.../node_modules/@scope/name/dist/index.js` belongs to the package at `.../node_modules/@scope/name`.
const packageFolder = (file: string) => {
  const parts = toPosix(file).split("/");
  const index = parts.lastIndexOf("node_modules");
  return parts.slice(0, index + (parts[index + 1]?.startsWith("@") ? 3 : 2)).join("/");
};

// Installing a package adds an entry to a `node_modules` folder the project's files resolve from.
const nodeModulesFolders = (root: string, sources: string[]) => {
  const folders = new Set<string>();
  const visited = new Set<string>();
  for (const source of sources) {
    for (let folder = dirname(source); !visited.has(folder); folder = dirname(folder)) {
      visited.add(folder);
      if (existsSync(join(folder, "node_modules"))) folders.add(join(folder, "node_modules"));
      if (folder === root || dirname(folder) === folder) break;
    }
  }
  return folders;
};

/**
 * Every file whose change can change the build: the sources it read, wherever they live, files that
 * broke it, the project's package manifests and lockfiles, the manifests of the packages it
 * resolved, and the `node_modules` folders new packages are installed into.
 */
export const collectInputs = (root: string, read: string[], canvases: CanvasEntry[], failedFiles: Set<string>) => {
  const sources = [
    ...read.filter((file) => !inNodeModules(file)),
    ...canvases.flatMap((canvas) => [join(root, canvas.id), ...(canvas.preview ? [join(root, canvas.preview)] : [])]),
    ...failedFiles,
  ];
  const packages = read.filter(inNodeModules).map((file) => join(packageFolder(file), "package.json"));
  const projectFiles = PROJECT_FILES.map((name) => join(root, name)).filter((file) => existsSync(file));
  return new Set(
    [...sources, ...projectFiles, ...packages, ...nodeModulesFolders(root, sources)].map((file) => resolve(file)),
  );
};

/**
 * Modification times keyed by `inputKey`. A file changed at or after `startedAt` may have been read
 * before or after the change, so it is recorded as unknown and the next check rebuilds.
 */
export const readInputs = async (root: string, files: Set<string>, startedAt: number) => {
  const inputs: Record<string, number> = {};
  for (const file of [...files].sort()) {
    const info = await stat(file).catch(() => undefined);
    if (info) inputs[inputKey(root, file)] = info.mtimeMs >= startedAt ? -1 : info.mtimeMs;
  }
  return inputs;
};

/** True when every recorded input still has the recorded modification time. */
export const inputsUnchanged = async (root: string, inputs: Record<string, number>) => {
  for (const [key, modified] of Object.entries(inputs)) {
    const info = await stat(inputPath(root, key)).catch(() => undefined);
    if (info?.mtimeMs !== modified) return false;
  }
  return true;
};
