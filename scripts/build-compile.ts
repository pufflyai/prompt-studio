import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { $ } from "bun";

const DASHBOARD_DIST = "./packages/pstdio-dashboard/dist";
const CLI_ENTRY = "./packages/pstdio/src/index.ts";

const collectFiles = (dir: string): string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
};

// 1. Build all packages
console.log("Building packages...");
await $`bun run --filter pstdio-dashboard build`;
await $`bun run --filter pstdio-api build`;

// 2. Collect dashboard dist files for embedding
console.log("Collecting dashboard assets...");
const distFiles = collectFiles(DASHBOARD_DIST);
const embedArgs = distFiles.flatMap((f) => ["--embed", f]);

console.log(`  Found ${distFiles.length} files to embed`);
for (const f of distFiles) {
  console.log(`    ${relative(".", f)}`);
}

// 3. Compile for local platform (Phase 1: darwin-arm64 only)
const target = `bun-${process.platform}-${process.arch}`;
const outfile = "./dist/pstdio";

console.log(`\nCompiling for ${target}...`);
await $`bun build ${CLI_ENTRY} --compile --target=${target} ${embedArgs} --outfile ${outfile}`;

console.log(`\nCompiled binary: ${outfile}`);
console.log("Verify with: ./dist/pstdio --version");
