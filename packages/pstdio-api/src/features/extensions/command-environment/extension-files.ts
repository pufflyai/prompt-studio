import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";

const ignoreEntry = (extensionId: string) => `/ext/${extensionId}/`;
const ignoreMarker = (extensionId: string) => `# pstdio:ignore-owned ${ignoreEntry(extensionId)}`;
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

const updateIgnore = async (repoPath: string, extensionId: string, tracked: boolean) => {
  await serializeIgnoreUpdate(repoPath, async () => {
    const path = join(repoPath, ".pstdio", ".gitignore");
    let lines: string[] = [];
    try {
      lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(dirname(path), { recursive: true });
    }
    const entry = ignoreEntry(extensionId);
    const marker = ignoreMarker(extensionId);
    const markerIndex = lines.indexOf(marker);
    let next = lines;
    if (tracked && markerIndex >= 0) {
      next = lines.filter(
        (_, index) => index !== markerIndex && !(index === markerIndex + 1 && lines[index] === entry),
      );
    } else if (!tracked && markerIndex < 0 && !lines.includes(entry)) {
      next = [...lines, marker, entry];
    }
    if (next.join("\n") === lines.join("\n")) return;
    await writeAtomic(path, next.length > 0 ? `${next.join("\n")}\n` : "");
  });
};

export const createExtensionFilesApi = (input: {
  extensionId: string;
  resolveRepoPath: () => Promise<string>;
  tracked: boolean;
}): ArtifactMount => {
  let mount: ArtifactMount | undefined;
  const mountFor = async () => {
    if (!mount) {
      const repoPath = await input.resolveRepoPath();
      mount = createFileMount(join(repoPath, ".pstdio", "ext", input.extensionId));
    }
    return mount;
  };
  const beforeWrite = async () => {
    const repoPath = await input.resolveRepoPath();
    await updateIgnore(repoPath, input.extensionId, input.tracked);
    return mountFor();
  };
  return {
    exists: async (path) => (await mountFor()).exists(path),
    readText: async (path) => (await mountFor()).readText(path),
    writeText: async (path, value) => (await beforeWrite()).writeText(path, value),
    readBytes: async (path) => (await mountFor()).readBytes(path),
    writeBytes: async (path, value) => (await beforeWrite()).writeBytes(path, value),
    list: async (pattern) => (await mountFor()).list(pattern),
    listDirs: async (path) => (await mountFor()).listDirs(path),
    delete: async (path) => (await mountFor()).delete(path),
  };
};
