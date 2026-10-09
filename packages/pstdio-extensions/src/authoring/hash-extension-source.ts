import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createExtensionIgnoreMatcher } from "./extension-ignore";

export const hashExtensionSource = (sourcePath: string) => {
  const hash = createHash("sha256");
  const matcher = createExtensionIgnoreMatcher(sourcePath);

  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      const rel = relative(sourcePath, path);
      if (matcher.ignores(rel)) continue;

      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        const stat = statSync(path);
        hash.update(`${rel}:${stat.size}\n`);
        hash.update(readFileSync(path));
      }
    }
  };

  visit(sourcePath);
  return hash.digest("hex");
};
