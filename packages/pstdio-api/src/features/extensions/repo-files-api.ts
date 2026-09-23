import { resolve } from "node:path";
import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";
import { createFileMount } from "pstdio-extensions";
import type { FileAccess } from "./command-environment/workspace-files";

// Resolve the trusted workspace target and its current capabilities on every call.
export const createRepoFilesApi = (resolveRepoPath: (access: FileAccess) => Promise<string>): ArtifactMount => {
  const mountFor = async (access: FileAccess) => createFileMount(resolve(await resolveRepoPath(access)));

  return {
    exists: async (path) => (await mountFor("read")).exists(path),
    readText: async (path) => (await mountFor("read")).readText(path),
    writeText: async (path, value) => (await mountFor("write")).writeText(path, value),
    readBytes: async (path) => (await mountFor("read")).readBytes(path),
    writeBytes: async (path, value) => (await mountFor("write")).writeBytes(path, value),
    list: async (pattern) => (await mountFor("read")).list(pattern),
    listDirs: async (path) => (await mountFor("read")).listDirs(path),
    delete: async (path) => (await mountFor("write")).delete(path),
  };
};
