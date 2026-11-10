import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};
export const resolveRevisionModule = (
  specifier: string,
  from: string,
  canonical: string,
  sourceRoot: string,
  regularDependency?: string | null,
) => {
  try {
    if (specifier.startsWith("file:")) specifier = fileURLToPath(specifier);
    if (specifier.includes(":") && !isAbsolute(specifier)) return null;
    const file = realpathSync(Bun.resolveSync(specifier, from));
    if (regularDependency && inside(regularDependency, file)) return { owner: regularDependency, file };
    if (inside(canonical, file) && !relative(canonical, file).split(/[/\\]/).includes("node_modules"))
      return { owner: canonical, file };
    let owner = dirname(file);
    while (!existsSync(join(owner, "package.json"))) {
      const parent = dirname(owner);
      if (parent === owner) return { owner: dirname(file), file };
      owner = parent;
    }
    // A shared loose source folder must not turn its whole enclosing repository
    // into an opaque dependency. Its selected files/assets get their own record.
    return { owner: inside(owner, sourceRoot) ? dirname(file) : owner, file };
  } catch {
    return null;
  }
};
