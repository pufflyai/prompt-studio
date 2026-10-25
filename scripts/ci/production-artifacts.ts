import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import type { ProductionCandidate } from "./production-candidate";

interface Artifact {
  id: number;
  name: string;
  digest: string;
  expired: boolean;
}
export const selectProductionArtifacts = (artifacts: Artifact[], attempt: number, channel: string) => {
  const targets = ["linux-x64", "darwin-arm64", "darwin-x64"];
  if (channel === "stable") targets.push("win32-x64");
  const required = [
    `release-build-attempt-${attempt}`,
    ...targets.flatMap((target) => [`desktop-${target}`, `validation-app-${target}`]),
    "service-container-relay",
    "service-container-account-manager",
  ];
  const missing = required.filter((name) => !artifacts.some((artifact) => artifact.name === name));
  if (missing.length) throw new Error(`Missing production artifacts: ${missing.join(", ")}`);
  return required.map((name) => {
    const matches = artifacts.filter((artifact) => artifact.name === name);
    const artifact = matches[0]!;
    if (matches.length !== 1 || artifact.expired || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest))
      throw new Error(`${name}: artifact identity is unavailable or ambiguous`);
    return { id: artifact.id, name, digest: artifact.digest };
  });
};

type BuildIdentity = Pick<ProductionCandidate, "sourceSha" | "versionSha" | "toolchain">;
export const requireProductionBuild = (actual: BuildIdentity, expected: BuildIdentity) => {
  if (
    actual.sourceSha !== expected.sourceSha ||
    actual.versionSha !== expected.versionSha ||
    actual.toolchain !== expected.toolchain
  )
    throw new Error("Candidate build identity mismatch");
};

export const productionPolicyDigest = () => {
  const policyFiles = [
    ...new Bun.Glob("scripts/ci/production-*.ts").scanSync("."),
    ...new Bun.Glob(".github/workflows/production-*.yml").scanSync("."),
    "scripts/ci/test-policy.ts",
    "scripts/ci/run-ci-checks.ts",
    "scripts/verify/verify-packages.ts",
    "scripts/verify/packaged-build.ts",
    "scripts/verify/packaged-runtime-smoke.ts",
    ".github/workflows/test-and-build.yml",
    ".github/workflows/release-packages.yml",
    ".github/workflows/release-desktop.yml",
    ".github/workflows/verify-packaged-toolchain.yml",
    ".github/actions/build-release/action.yml",
    ".github/actions/publish-release/action.yml",
    "bun.lock",
    "package.json",
  ]
    .filter((path) => !path.endsWith(".test.ts"))
    .sort();
  const policy = createHash("sha256");
  for (const path of policyFiles) policy.update(path).update(readFileSync(path));
  return policy.digest("hex");
};

if (import.meta.main) {
  const pages = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as Array<{ artifacts: Artifact[] }>;
  const policyDigest = productionPolicyDigest();
  const candidate: ProductionCandidate = {
    artifactRunId: process.env.ARTIFACT_RUN_ID!,
    artifactAttempt: Number(process.env.ARTIFACT_ATTEMPT),
    sourceSha: process.env.SOURCE_SHA!,
    versionSha: process.env.VERSION_SHA!,
    toolchain: `bun-${Bun.version}`,
    policyDigest,
    artifacts: selectProductionArtifacts(
      pages.flatMap((page) => page.artifacts),
      Number(process.env.ARTIFACT_ATTEMPT),
      process.env.CHANNEL!,
    ),
  };
  requireProductionBuild(JSON.parse(readFileSync("production-build-identity.json", "utf8")), candidate);
  await Bun.write("production-candidate.json", `${JSON.stringify(candidate, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Candidate\n\n${JSON.stringify(candidate, null, 2)}\n`);
}
