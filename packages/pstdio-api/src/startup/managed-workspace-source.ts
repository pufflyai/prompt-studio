import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sourceMatchesPublication } from "../features/extensions/publication/source";

const visit = async (
  root: string,
  directory: string,
  files: Set<string>,
  directories: Set<string>,
): Promise<boolean> => {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    // Source promotion retains this installation-owned dependency directory.
    if (path === "node_modules") continue;
    if (entry.isSymbolicLink()) return false;
    if (entry.isDirectory()) {
      if (!directories.has(path) || !(await visit(root, path, files, directories))) return false;
    } else if (!entry.isFile() || !files.has(path)) return false;
  }
  return true;
};

/** Publication omits private files. Replacement must also prove that none would be discarded. */
export const matchesManagedWorkspaceSource = async (root: string, baseline: Blob) => {
  if (!(await sourceMatchesPublication(root, baseline))) return false;
  const snapshot = JSON.parse(await baseline.text()) as { files: Array<{ path: string }> };
  const files = new Set(snapshot.files.map(({ path }) => path));
  const directories = new Set(
    snapshot.files.flatMap(({ path }) => {
      const parts = path.split("/");
      parts.pop();
      return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
    }),
  );

  return visit(root, "", files, directories);
};
