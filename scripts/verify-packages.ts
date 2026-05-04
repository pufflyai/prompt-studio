import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadEmbedConfig } from "./lib/embed-manifest";

const config = loadEmbedConfig();

let failed = false;

for (const { pkg, bin } of config.platformBinaries) {
  const binPath = join("./packages/pstdio/dist/platforms", pkg, "bin", bin);

  if (!existsSync(binPath)) {
    process.stderr.write(`MISSING: ${binPath}\n`);
    failed = true;
    continue;
  }

  const stat = statSync(binPath);
  process.stdout.write(`OK: ${binPath} (${(stat.size / 1_000_000).toFixed(1)} MB)\n`);
}

if (failed) {
  process.stderr.write("\nVerification failed: some binaries are missing.\n");
  process.exit(1);
}

process.stdout.write("\nRunning packaged runtime smoke check...\n");
const smoke = spawnSync("bun", ["test", "packages/e2e/src/packaged/packaged-serve-smoke.test.ts", "--silent"], {
  stdio: "inherit",
  env: process.env,
});

if (smoke.status !== 0) {
  process.stderr.write("\nVerification failed: packaged runtime smoke check failed.\n");
  process.exit(smoke.status ?? 1);
}

process.stdout.write("\nAll platform binaries and packaged runtime smoke checks passed.\n");
