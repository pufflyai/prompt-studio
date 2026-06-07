import type { ArtifactMount } from "@pstdio/sdk/extensions";

// Minimal in-memory ArtifactMount mirroring ctx.repoFiles for command tests: paths
// are repo-root relative, list() matches a literal-prefix + `**` glob.
export const createMemoryRepoFiles = (): ArtifactMount & { files: Map<string, string> } => {
  const files = new Map<string, string>();

  return {
    files,
    exists: async (path) => files.has(path),
    readText: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`File not found: ${path}`);
      return value;
    },
    writeText: async (path, value) => {
      files.set(path, value);
    },
    readBytes: async (path) => new TextEncoder().encode(await Promise.resolve(files.get(path) ?? "")),
    writeBytes: async (path, value) => {
      files.set(path, new TextDecoder().decode(value));
    },
    list: async (pattern) => {
      const prefix = pattern ? pattern.replace(/\*+.*$/, "") : "";
      return [...files.keys()]
        .filter((path) => path.startsWith(prefix))
        .sort()
        .map((path) => ({ path }));
    },
    listDirs: async () => [],
    delete: async (path) => {
      files.delete(path);
    },
  };
};
