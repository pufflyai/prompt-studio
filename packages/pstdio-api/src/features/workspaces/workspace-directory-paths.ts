import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
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

export const isManagedWorkspaceDirectory = async (path: string) => {
  const rel = relative(await canonicalWorkspacePath(managedWorkspacesRoot()), await canonicalWorkspacePath(path));
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};
