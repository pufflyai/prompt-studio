import { cp } from "node:fs/promises";
import { join } from "node:path";

export const copyCiRuntime = (root: string) =>
  cp(import.meta.dirname, join(root, "scripts/ci"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
