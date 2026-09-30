import { readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

export const readWebviewBuildSignature = (distDir: string) => {
  try {
    return readFileSync(join(distDir, "build-signature.txt"), "utf8");
  } catch {
    return null;
  }
};

export const prepareWebviewBuildCache = (distDir: string, activeStages: Set<string>) => {
  // A failed replacement must not leave a reusable signature and a persisted error.
  rmSync(join(distDir, "build-signature.txt"), { force: true });
  const parent = dirname(distDir);
  let names: string[];
  try {
    names = readdirSync(parent);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith("dist.staging-") && !name.startsWith("source.staging-")) continue;
    const path = join(parent, name);
    if (!activeStages.has(path)) rmSync(path, { recursive: true, force: true });
  }
};

export const removeUnownedWebviewBuilds = (cacheRoot: string, owners: string[]) => {
  let names: string[];
  try {
    names = readdirSync(cacheRoot);
  } catch {
    return;
  }
  for (const name of names) {
    if (!owners.includes(name)) rmSync(join(cacheRoot, name), { recursive: true, force: true });
  }
};
