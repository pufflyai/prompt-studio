import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertCoreBinarySize } from "../build/core-binary-size";
import { loadEmbedConfig } from "../build/embed-manifest";
import { collectVerifications } from "./collect-verifications";
import { getHostPlatformPackage, resolveCompiledBinaryPath, runCompiledBunSmoke } from "./compiled-bun-smoke";
import { packagedBuildCommand, packagedVerificationProfile } from "./packaged-build";
import { preparePackagedSmokeBrowser } from "./packaged-runtime-smoke";
import { runPackagedRuntimeTests } from "./packaged-runtime-tests";
import { verifyPublicPackages } from "./public-package-consumer";
import { verifyPublishedTypeExports } from "./published-type-exports";

const config = loadEmbedConfig();
const platformPackage = getHostPlatformPackage(config.platformBinaries);
const verifyPlatformPackage = process.env.PSTDIO_VERIFY_PLATFORM_PKG;
const platformBinaries = verifyPlatformPackage ? [platformPackage] : config.platformBinaries;
const buildCommand = packagedBuildCommand(process.argv.includes("--prebuilt"));
const profileIndex = process.argv.indexOf("--profile");
const profileName = profileIndex < 0 ? "full" : process.argv[profileIndex + 1]!;
const shardIndex = process.argv.indexOf("--shard");
const shard = shardIndex < 0 ? undefined : (process.argv[shardIndex + 1] ?? "");
const profile = packagedVerificationProfile(profileName, process.platform);
console.log(`Packaged verification profile: ${profileName} on ${process.platform}-${process.arch}`);
console.log(
  `Public package contracts ${profile.publicContracts ? "selected" : "not selected"}: ${profile.publicContractsReason}.`,
);
console.log(
  `Compiled file integrity and embedded Bun smoke selected; full packaged runtime cases ${profile.runtime ? "selected" : "not selected"}.`,
);
let buildFailed = false;
if (buildCommand) {
  console.log(`[${new Date().toISOString()}] build compiled packages`);
  const build = spawnSync(buildCommand[0]!, buildCommand.slice(1), {
    stdio: "inherit",
    env: verifyPlatformPackage ? { ...process.env, PSTDIO_BUILD_PLATFORM_PKG: platformPackage.pkg } : process.env,
  });
  buildFailed = build.status !== 0;
  if (buildFailed) console.error("::error::Compiled package build failed");
  if (buildFailed && process.env.CI_PRIORITY === "P1") process.exit(1);
}

const errors = profile.publicContracts
  ? await collectVerifications([
      { id: "verify published types", run: () => verifyPublishedTypeExports(process.cwd()) },
      { id: "verify package consumers", run: () => verifyPublicPackages(process.cwd()) },
    ])
  : [];
// These checks all need the compiled candidate. A build failure still leaves the
// independent public-type and package-consumer diagnostics above available.
if (!buildFailed && (process.env.CI_PRIORITY !== "P1" || errors.length === 0)) {
  const hostBinaryPath = resolveCompiledBinaryPath(platformPackage);
  errors.push(
    ...(await collectVerifications([
      {
        id: "verify compiled files",
        run: () => {
          const missing: string[] = [];
          for (const { pkg, bin } of platformBinaries) {
            const path = join("./packages/pstdio/dist/platforms", pkg, "bin", bin);
            if (!existsSync(path)) missing.push(path);
            else {
              assertCoreBinarySize(path);
              console.log(`OK: ${path} (${(statSync(path).size / 1_000_000).toFixed(1)} MB)`);
            }
          }
          if (missing.length) throw new Error(`Missing binaries: ${missing.join(", ")}`);
        },
      },
      ...(profile.runtime
        ? [
            {
              id: "run packaged e2e",
              run: () => {
                preparePackagedSmokeBrowser(hostBinaryPath);
                runPackagedRuntimeTests({ cwd: "./packages/e2e", binaryPath: hostBinaryPath, shard });
              },
            },
          ]
        : []),
      { id: "run compiled CLI smoke", run: () => runCompiledBunSmoke(platformBinaries) },
    ])),
  );
}
if (buildFailed || errors.length) process.exitCode = 1;
else console.log("All selected packaged verification checks passed.");
