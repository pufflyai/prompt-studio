import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const extensionDependencyInputNames = ["package.json", "bun.lock", "bun.lockb"] as const;

export const hashExtensionDependencyInputs = (sourcePath: string) => {
  const hash = createHash("sha256");

  for (const name of extensionDependencyInputNames) {
    const path = join(sourcePath, name);
    if (!existsSync(path)) continue;
    hash.update(`${name}\n`);
    hash.update(readFileSync(path));
  }

  return hash.digest("hex");
};
