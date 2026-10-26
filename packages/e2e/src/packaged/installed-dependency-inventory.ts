import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join, relative } from "node:path";

export const inventoryInstalledDependencies = (root: string) => {
  const hash = createHash("sha256");
  let files = 0;
  let directories = 0;
  let links = 0;
  let bytes = 0;
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      const name = relative(root, path).replaceAll("\\", "/");
      const stats = lstatSync(path);
      if (stats.isSymbolicLink()) {
        links++;
        const target = readlinkSync(path).replaceAll(root, "<node_modules>").replaceAll("\\", "/");
        hash.update(JSON.stringify(["link", name, target]));
      } else if (stats.isDirectory()) {
        directories++;
        hash.update(JSON.stringify(["directory", name]));
        visit(path);
      } else if (stats.isFile()) {
        files++;
        bytes += stats.size;
        hash.update(JSON.stringify(["file", name, stats.size]));
        hash.update(readFileSync(path));
      } else throw new Error(`Unexpected dependency entry: ${path}`);
    }
  };
  visit(root);
  return { files, directories, links, bytes, digest: hash.digest("hex") };
};
