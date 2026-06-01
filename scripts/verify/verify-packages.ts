import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadEmbedConfig } from "../build/embed-manifest";
import { getHostPlatformPackage, resolveCompiledBinaryPath, runCompiledBunSmoke } from "./compiled-bun-smoke";
import { shouldRunPackagedRuntimeSmoke } from "./packaged-runtime-smoke";

const config = loadEmbedConfig();
const platformPackage = getHostPlatformPackage(config.platformBinaries);
const verifyPlatformPackage = process.env.PSTDIO_VERIFY_PLATFORM_PKG;
const platformBinaries = verifyPlatformPackage ? [platformPackage] : config.platformBinaries;

process.stdout.write(
  verifyPlatformPackage
    ? `Building selected compiled target: ${platformPackage.pkg}...\n`
    : "Building all compiled targets...\n",
);

const build = spawnSync("bun", ["run", "--cwd", "scripts", "build:all"], {
  stdio: "inherit",
  env: verifyPlatformPackage ? { ...process.env, PSTDIO_BUILD_PLATFORM_PKG: platformPackage.pkg } : process.env,
});

if (build.status !== 0) {
  process.stderr.write("\nVerification failed: all-target compiled build failed.\n");
  process.exit(build.status ?? 1);
}

let failed = false;

for (const { pkg, bin } of platformBinaries) {
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

if (shouldRunPackagedRuntimeSmoke(platformPackage)) {
  process.stdout.write("\nRunning packaged e2e checks...\n");
  const hostBinaryPath = resolveCompiledBinaryPath(platformPackage);
  const packagedE2e = spawnSync("bun", ["run", "--cwd", "packages/e2e", "test:packaged"], {
    stdio: "inherit",
    env: { ...process.env, PSTDIO_PACKAGED_BINARY_PATH: hostBinaryPath },
  });

  if (packagedE2e.status !== 0) {
    process.stderr.write("\nVerification failed: packaged e2e checks failed.\n");
    process.exit(packagedE2e.status ?? 1);
  }
} else {
  process.stdout.write(`\nSkipping packaged e2e checks for ${platformPackage.pkg}.\n`);
}

process.stdout.write("\nRunning compiled Bun CLI smoke check...\n");
runCompiledBunSmoke(platformBinaries);

process.stdout.write("\nAll platform binaries and packaged e2e checks passed.\n");
