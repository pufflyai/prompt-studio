import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stageSidecar } from "../src/packaging/stage-sidecar";
import { resolveSidecarTarget, validateSidecarArtifact } from "../src/runtime/sidecar-artifact";

const parseFlag = (args: string[], name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const repoRoot = resolve(import.meta.dirname, "../../..");
const desktopRoot = join(repoRoot, "clients", "desktop");
const packageJson = JSON.parse(readFileSync(join(desktopRoot, "package.json"), "utf8")) as { version: string };
const args = process.argv.slice(2);
const platform = (parseFlag(args, "--platform") ?? process.platform) as NodeJS.Platform;
const arch = parseFlag(args, "--arch") ?? process.arch;

if (platform !== process.platform || arch !== process.arch) {
  throw new Error(
    `Desktop sidecars must be built on their native target; requested ${platform}-${arch} from ${process.platform}-${process.arch}.`,
  );
}

const target = resolveSidecarTarget(platform, arch);
const build = spawnSync("bun", ["run", "--cwd", "scripts", "build:all"], {
  cwd: repoRoot,
  env: { ...process.env, PSTDIO_BUILD_PLATFORM_PKG: target.packageName },
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const sourcePath = join(
  repoRoot,
  "packages",
  "pstdio",
  "dist",
  "platforms",
  target.packageName,
  "bin",
  target.executable,
);
const resourcesPath = join(desktopRoot, ".sidecar");
const staged = stageSidecar({
  sourcePath,
  resourcesPath,
  platform,
  arch,
  version: packageJson.version,
});

validateSidecarArtifact({
  resourcesPath,
  platform,
  arch,
  appVersion: packageJson.version,
});
process.stdout.write(`Desktop sidecar staged at ${staged.binaryPath}\n`);
