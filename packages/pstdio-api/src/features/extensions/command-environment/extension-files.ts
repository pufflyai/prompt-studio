import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount, createReadBoundary, type ExtensionStorageOwner, extensionFilesPath } from "pstdio-extensions";

import type { FileAccess } from "./workspace-files";

const ignoreEntry = (owner: ExtensionStorageOwner) => `${extensionFilesPath(owner).slice(".pstdio".length)}/`;
const ignoreMarker = (owner: ExtensionStorageOwner) => `# pstdio:ignore-owned ${ignoreEntry(owner)}`;
const ignoreUpdates = new Map<string, Promise<void>>();

const serializeIgnoreUpdate = async (repoPath: string, update: () => Promise<void>) => {
  const previous = ignoreUpdates.get(repoPath) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(update);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  ignoreUpdates.set(repoPath, tail);
  try {
    await run;
  } finally {
    if (ignoreUpdates.get(repoPath) === tail) ignoreUpdates.delete(repoPath);
  }
};

const writeAtomic = async (path: string, content: string) => {
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
};

const updateIgnore = async (repoPath: string, owner: ExtensionStorageOwner, tracked: boolean) => {
  await serializeIgnoreUpdate(repoPath, async () => {
    const path = join(repoPath, ".pstdio", ".gitignore");
    let lines: string[] = [];
    try {
      lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(dirname(path), { recursive: true });
    }
    const entry = ignoreEntry(owner);
    const marker = ignoreMarker(owner);
    const markerIndex = lines.indexOf(marker);
    let next = lines;
    if (tracked && markerIndex >= 0) {
      next = lines.filter(
        (_, index) => index !== markerIndex && !(index === markerIndex + 1 && lines[index] === entry),
      );
    } else if (
      !tracked &&
      markerIndex < 0 &&
      !lines.includes(entry) &&
      !lines.includes("/extension-storage") &&
      !lines.includes("/extension-storage/")
    ) {
      next = [...lines, marker, entry];
    }
    if (next.join("\n") === lines.join("\n")) return;
    await writeAtomic(path, next.length > 0 ? `${next.join("\n")}\n` : "");
  });
};

export const createExtensionFilesApi = (
  input: ExtensionStorageOwner & {
    resolveRepoPath: (access: FileAccess) => Promise<string>;
    tracked: boolean;
    signal?: AbortSignal;
  },
): ArtifactMount => {
  const mountFor = async (access: FileAccess) =>
    createFileMount(join(await input.resolveRepoPath(access), extensionFilesPath(input)), input.signal);
  const readMount = () => createReadBoundary(input.signal)(() => mountFor("read"));
  const beforeWrite = async () => {
    const repoPath = await input.resolveRepoPath("write");
    await updateIgnore(repoPath, input, input.tracked);
    return mountFor("write");
  };
  return {
    exists: async (path) => (await readMount()).exists(path),
    readText: async (path) => (await readMount()).readText(path),
    writeText: async (path, value) => (await beforeWrite()).writeText(path, value),
    updateText: async (path, value) => (await beforeWrite()).updateText(path, value),
    readBytes: async (path) => (await readMount()).readBytes(path),
    writeBytes: async (path, value) => (await beforeWrite()).writeBytes(path, value),
    list: async (pattern) => (await readMount()).list(pattern),
    listDirs: async (path) => (await readMount()).listDirs(path),
    delete: async (path) => (await mountFor("write")).delete(path),
  };
};
