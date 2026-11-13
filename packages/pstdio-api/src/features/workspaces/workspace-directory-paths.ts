import { realpath } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { resolvePstdioWorkspacesPath } from "pstdio-paths";

export const managedWorkspacesRoot = () => resolvePstdioWorkspacesPath({ env: process.env });

export const canonicalWorkspacePath = async (path: string) => {
  let current = resolve(path);
  const missing: string[] = [];
  while (true) {
    try {
      return resolve(await realpath(current), ...missing);
    } catch (error) {
      const parent = dirname(current);
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || parent === current) throw error;
      missing.unshift(basename(current));
      current = parent;
    }
  }
};
