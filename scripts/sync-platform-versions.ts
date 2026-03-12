import { readFileSync, writeFileSync } from "node:fs";

const PKG_PATH = "./packages/pstdio/package.json";

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const { version } = pkg;

const PLATFORM_PACKAGES = [
  "@pstdio/cli-darwin-arm64",
  "@pstdio/cli-darwin-x64",
  "@pstdio/cli-linux-x64",
  "@pstdio/cli-linux-arm64",
  "@pstdio/cli-linux-x64-musl",
  "@pstdio/cli-linux-arm64-musl",
  "@pstdio/cli-win-x64",
  "@pstdio/cli-win-arm64",
];

let changed = false;

for (const name of PLATFORM_PACKAGES) {
  if (pkg.optionalDependencies[name] !== version) {
    pkg.optionalDependencies[name] = version;
    changed = true;
  }
}

if (changed) {
  writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, "\t")}\n`);
  console.log(`Synced optionalDependencies to ${version}`);
} else {
  console.log(`optionalDependencies already at ${version}`);
}
