import type { ArtifactMount } from "@pstdio/sdk/extensions";

export const createMemoryRepoFiles = (): ArtifactMount & { files: Map<string, Uint8Array> } => {
  const files = new Map<string, Uint8Array>();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return {
    files,
    exists: async (path) => files.has(path) || [...files.keys()].some((file) => file.startsWith(`${path}/`)),
    readText: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`File not found: ${path}`);
      return decoder.decode(value);
    },
    writeText: async (path, value) => {
      files.set(path, encoder.encode(value));
    },
    readBytes: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`File not found: ${path}`);
      return value;
    },
    writeBytes: async (path, value) => {
      files.set(path, value);
    },
    list: async (pattern) => {
      const prefix = pattern ? pattern.replace(/\*+.*/, "") : "";
      return [...files.keys()]
        .filter((path) => path.startsWith(prefix))
        .sort()
        .map((path) => ({ path }));
    },
    listDirs: async () => [],
    delete: async (path) => {
      for (const file of [...files.keys()]) {
        if (file === path || file.startsWith(`${path}/`)) files.delete(file);
      }
    },
  };
};
