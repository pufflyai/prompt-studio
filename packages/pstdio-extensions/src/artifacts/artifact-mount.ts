import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, posix, resolve } from "node:path";
import type { ArtifactFile, ArtifactMount } from "@pstdio/sdk/extensions";
import { normalizeArtifactMountPath } from "./path-normalization";

type CreateArtifactMountInput = {
  repoRoot: string;
  /** Package name of the owning extension. */
  name: string;
  mountPath: string;
};

const normalizeRelativePath = (path: string) => {
  if (path.includes("\0")) throw new Error("Artifact path escapes mount root");

  const slashPath = path.replaceAll("\\", "/");
  if (slashPath.startsWith("/")) throw new Error("Artifact path escapes mount root");

  const normalized = posix.normalize(slashPath);
  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Artifact path escapes mount root");
  }

  return normalized.replace(/\/$/, "");
};

const globPatternToRegExp = (pattern: string) => {
  const body = pattern.replace(/\*\*\/|\*\*|\*|[.+^${}()|[\]\\]/g, (token) => {
    if (token === "**/") return "(?:.*/)?";
    if (token === "**") return ".*";
    if (token === "*") return "[^/]*";
    return `\\${token}`;
  });
  return new RegExp(`^${body}$`);
};

const toPosixPath = (path: string) =>
  path
    .split(/[/\\]+/)
    .filter(Boolean)
    .join("/");

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
      size: fileStats.size,
      updatedAt: fileStats.mtime.toISOString(),
    });
  }
};

export const createArtifactMount = (input: CreateArtifactMountInput): ArtifactMount => {
  const normalized = normalizeArtifactMountPath(input.mountPath);
  if (!normalized) {
    throw new Error(`Artifact mount path "${input.mountPath}" must stay under .pstdio/${input.name}/`);
  }

  const mountRoot = resolve(input.repoRoot, ".pstdio", input.name, ...normalized.split("/"));

  const resolvePath = (relativePath: string) => {
    const safe = normalizeRelativePath(relativePath);
    return {
      absolutePath: safe ? resolve(mountRoot, ...safe.split("/")) : mountRoot,
      relativePath: safe,
    };
  };

  return {
    exists: async (path) => existsSync(resolvePath(path).absolutePath),
    readText: async (path) => readFile(resolvePath(path).absolutePath, "utf8"),
    writeText: async (path, value) => {
      const { absolutePath } = resolvePath(path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, value, "utf8");
    },
    readBytes: async (path) => new Uint8Array(await readFile(resolvePath(path).absolutePath)),
    writeBytes: async (path, value) => {
      const { absolutePath } = resolvePath(path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, value);
    },
    list: async (pattern) => {
      if (!existsSync(mountRoot)) return [];
      const files: ArtifactFile[] = [];
      await walkFiles(mountRoot, mountRoot, files);
      const matcher = pattern ? globPatternToRegExp(pattern) : null;
      return files.filter((file) => !matcher || matcher.test(file.path)).sort((a, b) => a.path.localeCompare(b.path));
    },
    listDirs: async (path = "") => {
      const { absolutePath, relativePath } = resolvePath(path);
      if (!existsSync(absolutePath)) return [];
      const entries = await readdir(absolutePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => toPosixPath(posix.join(relativePath, entry.name)))
        .sort((a, b) => a.localeCompare(b));
    },
    delete: async (path) => {
      const { absolutePath, relativePath } = resolvePath(path);
      if (!relativePath) throw new Error("Artifact path is required");
      await rm(absolutePath, { recursive: true, force: true });
    },
  };
};
