import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PSTDIO_PKG_JSON = "./packages/pstdio/package.json";
const PLATFORMS_DIR = "./packages/pstdio/dist/platforms";

const TARGETS = [
  { pkg: "cli-darwin-arm64", name: "@pstdio/cli-darwin-arm64", os: "darwin", cpu: "arm64", bin: "pstdio" },
  { pkg: "cli-darwin-x64", name: "@pstdio/cli-darwin-x64", os: "darwin", cpu: "x64", bin: "pstdio" },
  { pkg: "cli-linux-x64", name: "@pstdio/cli-linux-x64", os: "linux", cpu: "x64", libc: "glibc", bin: "pstdio" },
  { pkg: "cli-linux-arm64", name: "@pstdio/cli-linux-arm64", os: "linux", cpu: "arm64", libc: "glibc", bin: "pstdio" },
  {
    pkg: "cli-linux-x64-musl",
    name: "@pstdio/cli-linux-x64-musl",
    os: "linux",
    cpu: "x64",
    libc: "musl",
    bin: "pstdio",
  },
  {
    pkg: "cli-linux-arm64-musl",
    name: "@pstdio/cli-linux-arm64-musl",
    os: "linux",
    cpu: "arm64",
    libc: "musl",
    bin: "pstdio",
  },
  { pkg: "cli-win-x64", name: "@pstdio/cli-win-x64", os: "win32", cpu: "x64", bin: "pstdio.exe" },
  { pkg: "cli-win-arm64", name: "@pstdio/cli-win-arm64", os: "win32", cpu: "arm64", bin: "pstdio.exe" },
];

const { version } = JSON.parse(readFileSync(PSTDIO_PKG_JSON, "utf8"));

for (const { pkg, name, os, cpu, libc, bin } of TARGETS) {
  const pkgDir = join(PLATFORMS_DIR, pkg);
  mkdirSync(pkgDir, { recursive: true });

  const packageJson = {
    name,
    version,
    os: [os],
    cpu: [cpu],
    libc: libc ? [libc] : undefined,
    main: "./index.cjs",
    files: ["bin", "index.cjs"],
    repository: { type: "git", url: "https://github.com/pufflyai/prompt-studio" },
    publishConfig: { access: "public" },
  };

  writeFileSync(join(pkgDir, "package.json"), `${JSON.stringify(packageJson, null, "\t")}\n`);

  const indexCjs = `const path = require("node:path");\nmodule.exports = path.join(__dirname, "bin", "${bin}");\n`;
  writeFileSync(join(pkgDir, "index.cjs"), indexCjs);

  console.log(`Scaffolded ${name}@${version}`);
}

console.log(`\nAll ${TARGETS.length} platform packages scaffolded.`);
