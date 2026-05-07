import { spawnSync } from "node:child_process";

const packageArtifactScopes = ["pstdio-dashboard", "pstdio-api"];

export const createPackageArtifactBuildArgs = () => [
  "run",
  "build",
  "--",
  ...packageArtifactScopes.flatMap((scope) => ["--scope", scope]),
  "--include-dependencies",
  "--stream",
];

export const buildPackageArtifacts = () => {
  const result = spawnSync("bun", createPackageArtifactBuildArgs(), {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error("Package artifact build failed.");
  }
};
