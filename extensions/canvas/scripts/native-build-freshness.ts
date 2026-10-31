import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generatedRoot, repoRoot } from "./story-catalog";

export const checkNativeBuildFreshness = async () => {
  const manifest = (await Bun.file(resolve(generatedRoot, "native-manifest.json")).json()) as {
    hashes: Record<string, string>;
    outputs: Record<string, string>;
    stories: number;
    bytes: number;
  };
  const stale: string[] = [];
  for (const [source, hash] of Object.entries(manifest.hashes)) {
    try {
      const actual = createHash("sha256")
        .update(await readFile(resolve(repoRoot, source)))
        .digest("hex");
      if (actual !== hash) stale.push(source);
    } catch {
      stale.push(source);
    }
  }
  for (const [file, hash] of Object.entries(manifest.outputs)) {
    try {
      const actual = createHash("sha256")
        .update(await readFile(resolve(generatedRoot, file)))
        .digest("hex");
      if (actual !== hash) stale.push(`generated/${file}`);
    } catch {
      stale.push(`generated/${file}`);
    }
  }
  return { manifest, stale };
};
