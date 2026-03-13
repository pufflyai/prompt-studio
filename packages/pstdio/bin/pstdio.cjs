#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { resolvePackageName } = require("./resolve-package.cjs");

const pkg = resolvePackageName(process.platform, process.arch);

if (!pkg) {
  process.stderr.write(
    `pstdio: unsupported platform ${process.platform}-${process.arch}.\n` +
      `Supported: darwin-arm64, darwin-x64, linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl, win-x64, win-arm64\n`,
  );
  process.exit(1);
}

const binPath = require(pkg);
const result = spawnSync(binPath, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
