import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import { normalizeArtifactPath } from "./path-normalization";

type CreateArtifactMountInput = {
  repoRoot: string;
  mountPath: string;
};

type ArtifactFile = {
  path: string;
  sizeBytes: number;
};

type ArtifactMountApi = {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, value: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array>;
  writeBytes(path: string, value: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<ArtifactFile[]>;
  listDirs(path?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
};

const normalizeRelativeArtifactPath = (path: string) => {
  const slashPath = path.replaceAll("\\", "/");
  if (slashPath.startsWith("/") || slashPath.includes("\0")) {
    throw new Error("Artifact path escapes mount root");
  }

  const normalized = posix.normalize(slashPath);
  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Artifact path escapes mount root");
  }

  return normalized.replace(/\/$/, "");
};

const globPatternToRegExp = (pattern: string) => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\0")
    .replaceAll("*", "[^/]*")
    .replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`);
};

const toPosixPath = (path: string) => path.split("/").filter(Boolean).join("/");

const resolveMountFile = (mountRoot: string, path: string) => {
  const relativePath = normalizeRelativeArtifactPath(path);
  return {
    absolutePath: relativePath ? resolve(mountRoot, ...relativePath.split("/")) : mountRoot,
    relativePath,
  };
};

const walkFiles = async (root: string, current: string, files: ArtifactFile[]) => {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(root, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) continue;

    const fileStats = await stat(absolutePath);
    files.push({
      path: toPosixPath(absolutePath.slice(root.length)),
      sizeBytes: fileStats.size,
    });
  }
};

export const createArtifactMount = (input: CreateArtifactMountInput) => {
  const normalizedMountPath = normalizeArtifactPath(input.mountPath);
  if (!normalizedMountPath) {
    throw new Error("Artifact mount path must stay under .pstdio");
  }

  const mountRoot = resolve(input.repoRoot, ...normalizedMountPath.split("/"));

  const exists: ArtifactMountApi["exists"] = async (path) => {
    const { absolutePath } = resolveMountFile(mountRoot, path);
    return existsSync(absolutePath);
  };

  const readText: ArtifactMountApi["readText"] = async (path) => {
    const { absolutePath } = resolveMountFile(mountRoot, path);
    return readFile(absolutePath, "utf8");
  };

  const writeText: ArtifactMountApi["writeText"] = async (path, value) => {
    const { absolutePath } = resolveMountFile(mountRoot, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, value, "utf8");
  };

  const readBytes: ArtifactMountApi["readBytes"] = async (path) => {
    const { absolutePath } = resolveMountFile(mountRoot, path);
    return new Uint8Array(await readFile(absolutePath));
  };

  const writeBytes: ArtifactMountApi["writeBytes"] = async (path, value) => {
    const { absolutePath } = resolveMountFile(mountRoot, path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, value);
  };

  const list: ArtifactMountApi["list"] = async (pattern) => {
    if (!existsSync(mountRoot)) return [];

    const files: ArtifactFile[] = [];
    await walkFiles(mountRoot, mountRoot, files);
    const matcher = pattern ? globPatternToRegExp(pattern) : null;
    return files.filter((file) => !matcher || matcher.test(file.path)).sort((a, b) => a.path.localeCompare(b.path));
  };

  const listDirs: ArtifactMountApi["listDirs"] = async (path = "") => {
    const { absolutePath, relativePath } = resolveMountFile(mountRoot, path);
    if (!existsSync(absolutePath)) return [];

    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => toPosixPath(posix.join(relativePath, entry.name)))
      .sort((a, b) => a.localeCompare(b));
  };

  const deletePath: ArtifactMountApi["delete"] = async (path) => {
    const { absolutePath, relativePath } = resolveMountFile(mountRoot, path);
    if (!relativePath) throw new Error("Artifact path is required");
    await rm(absolutePath, { recursive: true, force: true });
  };

  return {
    exists,
    readText,
    writeText,
    readBytes,
    writeBytes,
    list,
    listDirs,
    delete: deletePath,
  } satisfies ArtifactMountApi;
};
