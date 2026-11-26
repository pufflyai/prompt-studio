import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";

export const fingerprintUpgradeWorkingTree = (root: string, options: { ignoreGit?: boolean } = {}) => {
  if (!lstatSync(root).isDirectory()) throw new Error("Extension working copy must be a directory");
  const hash = createHash("sha256");
  const add = (entry: readonly (string | number)[]) => hash.update(JSON.stringify(entry)).update("\n");
  const skipRootEntry = (name: string) => {
    if (name !== ".git") return name === "node_modules";
    if (options.ignoreGit) return true;
    throw new Error("The extension working copy contains Git history");
  };
  const visit = (path: string, prefix: string) => {
    for (const name of readdirSync(path).sort()) {
      if (!prefix && skipRootEntry(name)) continue;
      const file = join(path, name);
      const key = prefix + name;
      const stat = lstatSync(file);
      if (stat.isDirectory()) {
        add([key, "directory"]);
        visit(file, `${key}/`);
      } else if (stat.isSymbolicLink()) {
        add([key, "link", readlinkSync(file)]);
      } else if (stat.isFile()) {
        const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
        add([key, "file", stat.mode & 0o111, digest]);
      } else {
        throw new Error("Extension working copy contains an unsupported file");
      }
    }
  };
  visit(root, "");
  return hash.digest("hex");
};
