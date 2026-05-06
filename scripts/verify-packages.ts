import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getHostPlatformPackage, resolveCompiledBinaryPath, runCompiledBunSmoke } from "./lib/compiled-bun-smoke";
import { loadEmbedConfig } from "./lib/embed-manifest";

const config = loadEmbedConfig();

process.stdout.write("Building all compiled targets...\n");
const build = spawnSync("bun", ["run", "scripts/build-all.ts"], {
  stdio: "inherit",
  env: process.env,
});

if (build.status !== 0) {
  process.stderr.write("\nVerification failed: all-target compiled build failed.\n");
  process.exit(build.status ?? 1);
}

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
const hostPlatformPackage = getHostPlatformPackage(config.platformBinaries);
const hostBinaryPath = resolveCompiledBinaryPath(hostPlatformPackage);
const smoke = spawnSync("bun", ["test", "packages/e2e/src/packaged/packaged-serve-smoke.test.ts", "--silent"], {
  stdio: "inherit",
  env: { ...process.env, PSTDIO_PACKAGED_BINARY_PATH: hostBinaryPath },
});

if (smoke.status !== 0) {
  process.stderr.write("\nVerification failed: packaged runtime smoke check failed.\n");
  process.exit(smoke.status ?? 1);
}

process.stdout.write("\nRunning compiled Bun CLI smoke check...\n");
runCompiledBunSmoke(config.platformBinaries);

process.stdout.write("\nAll platform binaries and packaged smoke checks passed.\n");
