import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const EXPECTED = [
  { pkg: "cli-darwin-arm64", bin: "pstdio" },
  { pkg: "cli-darwin-x64", bin: "pstdio" },
  { pkg: "cli-linux-x64", bin: "pstdio" },
  { pkg: "cli-linux-arm64", bin: "pstdio" },
  { pkg: "cli-linux-x64-musl", bin: "pstdio" },
  { pkg: "cli-linux-arm64-musl", bin: "pstdio" },
  { pkg: "cli-win-x64", bin: "pstdio.exe" },
  { pkg: "cli-win-arm64", bin: "pstdio.exe" },
];

let failed = false;

for (const { pkg, bin } of EXPECTED) {
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
