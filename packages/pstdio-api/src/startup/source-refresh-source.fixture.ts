import { cpSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { mirrorNodeModules } from "pstdio-extensions";

const repoRoot = resolve(import.meta.dirname, "../../../..");

export const prepareSourceRefreshFixture = (root: string) => {
  const original = join(repoRoot, "extensions/extension-lab");
  const source = join(root, "extension-lab");
  cpSync(original, source, { recursive: true, filter: (path) => basename(path) !== "node_modules" });
  mirrorNodeModules(join(original, "node_modules"), join(source, "node_modules"));
  return source;
};
