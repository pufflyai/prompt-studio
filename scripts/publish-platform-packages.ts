import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const PLATFORMS_DIR = "./packages/pstdio/dist/platforms";

const entries = readdirSync(PLATFORMS_DIR).filter((e) => e.startsWith("cli-"));

for (const entry of entries) {
  const pkgDir = join(PLATFORMS_DIR, entry);
  console.log(`Publishing ${entry}...`);
  await $`npm publish ${pkgDir} --provenance --access public`;
}

console.log(`\nPublished ${entries.length} platform packages.`);
