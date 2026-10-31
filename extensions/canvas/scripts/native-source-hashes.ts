import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

export const hashNativeBuildSources = async (repoRoot: string, sources: readonly string[]) => {
  const hashes: Record<string, string> = {};
  const root = await realpath(repoRoot);
  const normalized = new Set(sources.map((path) => path.split("?")[0].replaceAll("\\", "/")));
  for (const path of normalized) {
    if (path.split("/").some((segment) => segment === "node_modules" || segment === "__test-tmp__")) continue;
    if (!isAbsolute(path) || !(await Bun.file(path).exists())) continue;
    const canonicalPath = await realpath(path);
    const key = relative(root, canonicalPath).replaceAll("\\", "/");
    if (
      isAbsolute(key) ||
      key === ".." ||
      key.startsWith("../") ||
      key.split("/").some((segment) => segment === "node_modules" || segment === "__test-tmp__")
    )
      continue;
    if (key.includes("/catalog/generated/native") || key.endsWith("/catalog/generated/frame-bundle.ts")) continue;
    hashes[key] = createHash("sha256")
      .update(await readFile(canonicalPath))
      .digest("hex");
  }
  return hashes;
};
