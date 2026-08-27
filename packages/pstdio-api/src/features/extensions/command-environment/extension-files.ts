import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";

const ignoreEntry = (extensionId: string) => `/ext/${extensionId}/`;

const updateIgnore = async (repoPath: string, extensionId: string, tracked: boolean) => {
  const path = join(repoPath, ".pstdio", ".gitignore");
  let lines: string[] = [];
  try {
    lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
  } catch {
    await mkdir(dirname(path), { recursive: true });
  }
  const entry = ignoreEntry(extensionId);
  const next = tracked ? lines.filter((line) => line !== entry) : Array.from(new Set([...lines, entry]));
  if (next.join("\n") === lines.join("\n")) return;
  await writeFile(path, next.length > 0 ? `${next.join("\n")}\n` : "", "utf8");
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
