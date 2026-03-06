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
  const binPath = join("./dist/platforms", pkg, "bin", bin);

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

process.stdout.write("\nAll platform binaries verified.\n");
