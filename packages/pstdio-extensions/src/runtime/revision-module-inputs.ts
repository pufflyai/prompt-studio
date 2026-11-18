import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};
const containingPackage = (file: string) => {
  let owner = dirname(file);
  while (!existsSync(join(owner, "package.json"))) {
    const parent = dirname(owner);
    if (parent === owner) return dirname(file);
    owner = parent;
  }
  return owner;
};

export const createBrowserEntryResolver = () => {
  const entries = new Map<string, string | null>();
  return (canonical: string, target: string) => {
    const key = `${canonical}\0${target}`;
    const previous = entries.get(key);
    if (previous !== undefined) return previous;
    let file: string | null;
    try {
      file = Bun.resolveSync(join(canonical, target), canonical);
    } catch {
      file = null;
    }
    entries.set(key, file);
    return file;
  };
};

export const createRevisionModuleResolver = () => {
  const physicalPaths = new Map<string, string>();
  const resolvedFiles = new Map<string, string | null>();
  const physicalPath = (path: string) => {
    const previous = physicalPaths.get(path);
    if (previous !== undefined) return previous;
    const canonical = realpathSync(path);
    physicalPaths.set(path, canonical);
    return canonical;
  };
  const resolveFile = (specifier: string, from: string) => {
    const key = `${from}\0${specifier}`;
    const existing = resolvedFiles.get(key);
    if (existing !== undefined) return existing;
    let file: string | null;
    try {
      file = physicalPath(Bun.resolveSync(specifier, from));
    } catch {
      file = null;
    }
    resolvedFiles.set(key, file);
    return file;
  };
  return (
    specifier: string,
    from: string,
    canonical: string,
    sourceRoot: string,
    regularDependency?: string | null,
  ) => {
    try {
      if (specifier.startsWith("file:")) specifier = fileURLToPath(specifier);
      if (specifier.includes(":") && !isAbsolute(specifier)) return null;
      const file = resolveFile(specifier, from);
      if (!file) return null;
      if (regularDependency && inside(regularDependency, file)) return { owner: regularDependency, file };
      if (inside(canonical, file) && !relative(canonical, file).split(/[/\\]/).includes("node_modules"))
        return { owner: canonical, file };
      const owner = containingPackage(file);
      // A shared loose source folder must not turn its whole enclosing repository
      // into an opaque dependency. Its selected files/assets get their own record.
      return { owner: inside(owner, sourceRoot) ? dirname(file) : owner, file };
    } catch {
      return null;
    }
  };
};
