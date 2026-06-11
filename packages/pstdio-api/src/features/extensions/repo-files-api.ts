import { resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";

// Generic host file primitive: the invocation repo's working tree, scoped to its
// root. The root is resolved lazily from a trusted source (the registered repo
// path) rather than a client-supplied path, so a forged execute request cannot
// point repoFiles outside the project's repo.
export const createRepoFilesApi = (resolveRepoPath: () => Promise<string>): ArtifactMount => {
  let mount: ArtifactMount | undefined;
  const mountFor = async () => {
    if (!mount) mount = createFileMount(resolve(await resolveRepoPath()));
    return mount;
  };

  return {
    exists: async (path) => (await mountFor()).exists(path),
    readText: async (path) => (await mountFor()).readText(path),
    writeText: async (path, value) => (await mountFor()).writeText(path, value),
    readBytes: async (path) => (await mountFor()).readBytes(path),
    writeBytes: async (path, value) => (await mountFor()).writeBytes(path, value),
    list: async (pattern) => (await mountFor()).list(pattern),
    listDirs: async (path) => (await mountFor()).listDirs(path),
    delete: async (path) => (await mountFor()).delete(path),
  };
};
