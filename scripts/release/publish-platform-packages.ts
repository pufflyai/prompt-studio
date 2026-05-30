import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const PLATFORMS_DIR = "./packages/pstdio/dist/platforms";

const entries = readdirSync(PLATFORMS_DIR).filter((e) => e.startsWith("cli-"));

let published = 0;
let skipped = 0;

for (const entry of entries) {
  const pkgDir = join(PLATFORMS_DIR, entry);
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));
  const { name, version } = pkg;

  // Check if this version is already published
  const result = await $`npm view ${name}@${version} version 2>/dev/null`.quiet().nothrow();
  if (result.exitCode === 0 && result.text().trim() === version) {
    console.log(`Skipping ${name}@${version} (already published)`);
    skipped++;
    continue;
  }

  console.log(`Publishing ${name}@${version}...`);
  await $`npm publish ${pkgDir} --access public`;
  published++;
}

console.log(`\nDone: ${published} published, ${skipped} skipped (already on npm).`);
