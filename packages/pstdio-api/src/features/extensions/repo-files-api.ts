import { resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount, createReadBoundary } from "pstdio-extensions";

// Generic host file primitive: the invocation repo's working tree, scoped to its
// root. The root is resolved lazily from a trusted source (the registered repo
// path) rather than a client-supplied path, so a forged execute request cannot
// point repoFiles outside the project's repo.
export const createRepoFilesApi = (
  resolveRepoPath: (signal?: AbortSignal) => Promise<string>,
  signal?: AbortSignal,
): ArtifactMount => {
  let mount: ArtifactMount | undefined;
  const mountFor = async (readSignal?: AbortSignal) => {
    if (!mount) mount = createFileMount(resolve(await resolveRepoPath(readSignal)), signal);
    return mount;
  };
  const readMount = () => createReadBoundary(signal)(() => mountFor(signal));

  return {
    exists: async (path) => (await readMount()).exists(path),
    readText: async (path) => (await readMount()).readText(path),
    writeText: async (path, value) => (await mountFor()).writeText(path, value),
    updateText: async (path, value) => (await mountFor()).updateText(path, value),
    readBytes: async (path) => (await readMount()).readBytes(path),
    writeBytes: async (path, value) => (await mountFor()).writeBytes(path, value),
    list: async (pattern) => (await readMount()).list(pattern),
    listDirs: async (path) => (await readMount()).listDirs(path),
    delete: async (path) => (await mountFor()).delete(path),
  };
};
