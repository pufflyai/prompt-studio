import { copyFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

process.chdir(join(import.meta.dirname, ".."));

const args = Bun.argv.slice(2);
const packageArgIndex = args.indexOf("--package");
const packageName = packageArgIndex >= 0 ? args[packageArgIndex + 1] : "pstdio";
const cleanup = args.includes("--cleanup");

if (!packageName) {
  throw new Error("Missing package name after --package.");
}

const packageDir = join("packages", packageName);
const sourceReadmePath = "README.md";
const targetReadmePath = join(packageDir, "README.md");
const generatedMarkerPath = join(packageDir, ".readme.generated");

if (cleanup) {
  if (!existsSync(generatedMarkerPath)) {
    console.log(`No generated README marker for ${packageName}, skipping cleanup.`);
    process.exit(0);
  }

  rmSync(targetReadmePath, { force: true });
  rmSync(generatedMarkerPath, { force: true });
  console.log(`Removed generated README for ${packageName}.`);
  process.exit(0);
}

copyFileSync(sourceReadmePath, targetReadmePath);
writeFileSync(generatedMarkerPath, "generated\n");
console.log(`Synced ${sourceReadmePath} to ${targetReadmePath}.`);
