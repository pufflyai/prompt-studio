import { mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { $ } from "bun";

const DASHBOARD_DIST = "./packages/pstdio-dashboard/dist";
const CLI_ENTRY = "./packages/pstdio/src/index.ts";

const TARGETS = [
  { target: "bun-darwin-arm64", pkg: "cli-darwin-arm64", bin: "pstdio" },
  { target: "bun-darwin-x64", pkg: "cli-darwin-x64", bin: "pstdio" },
  { target: "bun-linux-x64", pkg: "cli-linux-x64", bin: "pstdio" },
  { target: "bun-linux-arm64", pkg: "cli-linux-arm64", bin: "pstdio" },
  { target: "bun-linux-x64-musl", pkg: "cli-linux-x64-musl", bin: "pstdio" },
  { target: "bun-linux-arm64-musl", pkg: "cli-linux-arm64-musl", bin: "pstdio" },
  { target: "bun-windows-x64", pkg: "cli-win-x64", bin: "pstdio.exe" },
  { target: "bun-windows-arm64", pkg: "cli-win-arm64", bin: "pstdio.exe" },
];

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

// 3. Compile for each target
for (const { target, pkg, bin } of TARGETS) {
  const outDir = `./dist/platforms/${pkg}/bin`;
  mkdirSync(outDir, { recursive: true });

  const outfile = join(outDir, bin);
  console.log(`\nCompiling for ${target}...`);
  await $`bun build ${CLI_ENTRY} --compile --target=${target} ${embedArgs} --outfile ${outfile}`;
  console.log(`  → ${relative(".", outfile)}`);
}

console.log("\nAll targets compiled.");
