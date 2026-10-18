import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";

const globMatcher = (pattern: string) =>
  new RegExp(
    `^${pattern.replace(/\*\*\/|\*\*|\*|[.+^${}()|[\]\\]/g, (token) => {
      if (token === "**/") return "(?:.*/)?";
      if (token === "**") return ".*";
      if (token === "*") return "[^/]*";
      return `\\${token}`;
    })}$`,
  );

export const createMemoryRepoFiles = () => {
  const updatedAt = new Map<string, string>();
  const directories = new Set<string>();
  class MemoryFiles extends Map<string, Uint8Array> {
    override set(path: string, value: Uint8Array) {
      updatedAt.set(path, new Date().toISOString());
      const parts = path.split("/");
      for (let index = 1; index < parts.length; index++) directories.add(parts.slice(0, index).join("/"));
      return super.set(path, value.slice());
    }
  }
  const files = new MemoryFiles();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const write = (path: string, value: Uint8Array) => {
    files.set(path, value);
  };
  const mount: ArtifactMount = {
    exists: async (path) => !path || files.has(path) || directories.has(path),
    readText: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`File not found: ${path}`);
      return decoder.decode(value);
    },
    writeText: async (path, value) => write(path, encoder.encode(value)),
    updateText: async (path, value) => {
      if (!files.has(path)) throw new Error(`File not found: ${path}`);
      write(path, encoder.encode(value));
    },
    readBytes: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`File not found: ${path}`);
      return value.slice();
    },
    writeBytes: async (path, value) => write(path, value),
    list: async (pattern) => {
      const matcher = pattern ? globMatcher(pattern) : null;
      return [...files.entries()]
        .filter(([path]) => !matcher || matcher.test(path))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, value]) => ({ path, size: value.byteLength, updatedAt: updatedAt.get(path) }));
    },
    listDirs: async (path = "") => {
      const prefix = path ? `${path}/` : "";
      return [...directories]
        .filter((dir) => dir.startsWith(prefix) && !dir.slice(prefix.length).includes("/"))
        .sort((a, b) => a.localeCompare(b));
    },
    delete: async (path) => {
      const matches = [...files.keys()].filter((file) => file === path || file.startsWith(`${path}/`));
      if (!directories.has(path) && matches.length === 0)
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
      for (const file of matches) {
        files.delete(file);
        updatedAt.delete(file);
      }
      for (const dir of directories) if (dir === path || dir.startsWith(`${path}/`)) directories.delete(dir);
    },
  };
  return { ...mount, files };
};
