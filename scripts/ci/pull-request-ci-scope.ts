import { appendFileSync } from "node:fs";
import { basename } from "node:path";
import { changedFiles } from "./changed-files";
import { affectedPackages } from "./ci-packages";
import { createEditedTestMatrix, editedTestFiles } from "./edited-test-matrix";
import { partitionPackageChecks } from "./package-check-matrix";
import { productionDesktopCheckPlatforms, productionToolchainPlatforms } from "./production-platforms";
import { plannedCiJobs, requiredCiJobs } from "./required-ci-jobs";
import { sourceCoverageArtifacts } from "./source-coverage-artifacts";
import { discoverTestFiles, priorityFromFile } from "./test-discovery";
import { createTestMatrices } from "./test-matrices";
import type { TestPriority } from "./test-policy";
import { readWorkspacePackages } from "./workspace-packages";

interface CiScopeInput {
  event: string;
  labels: string[];
  changedFiles: string[];
  packages: ReturnType<typeof readWorkspacePackages>;
  tests: string[];
  profile?: string;
  releaseChannel?: string;
}
const documentation = (file: string) =>
  /\.(md|mdx|txt)$/.test(file) || file.startsWith("design/") || file === "LICENSE";

const sharedBuildInput = (file: string) =>
  file.startsWith("scripts/build/") || ["scripts/release/stage-package.ts", "scripts/test-setup.ts"].includes(file);

const stageFor = (event: string, production: boolean, profile?: string) => {
  if (production) return "full";
  if (event === "pull_request") return "pull_request";
  if (event === "push" && profile !== "merge_queue") return "main";
  return "merge_queue";
};

const prioritiesFor = (stage: ReturnType<typeof stageFor>): TestPriority[] => {
  if (stage === "full") return ["P0", "P1", "P2"];
  return stage === "merge_queue" ? ["P0", "P1"] : ["P0"];
};

export const resolveCiScope = (input: CiScopeInput) => {
  const { event, labels, changedFiles, packages, tests, profile, releaseChannel = "stable" } = input;
  for (const file of tests) priorityFromFile(file);
  const production = profile === "production" || (event === "workflow_dispatch" && profile !== "merge_queue");
  const stage = stageFor(event, production, profile);
  const code = changedFiles.filter((file) => !documentation(file));
  const shared = code.some((file) => sharedBuildInput(file) || !packages.some((pkg) => file.startsWith(`${pkg.dir}/`)));
  let affectedOwners = affectedPackages(packages, code);
  if (shared || stage !== "pull_request") affectedOwners = packages.map((pkg) => pkg.name).sort();
  if (stage === "main") affectedOwners = [];
  const matrices = createTestMatrices(tests, packages, affectedOwners, prioritiesFor(stage));
  const componentMatrix = stage === "merge_queue" ? [] : matrices.componentMatrix;
  const browserSmoke = stage === "main" || stage === "merge_queue";
  const clientMatrix = (production ? productionDesktopCheckPlatforms(releaseChannel) : []).map((row) => ({
    ...row,
    os: row.platform === "linux" ? "ubuntu-latest" : row.os,
    tests: true,
  }));
  return {
    stage,
    production,
    sourceCoverage: production && releaseChannel === "nightly",
    affectedOwners,
    editedMatrix:
      stage === "pull_request" ? createEditedTestMatrix(editedTestFiles(tests, code, packages), packages) : [],
    ...matrices,
    appMatrix: production ? matrices.appMatrix : [],
    packagedMatrix: production ? matrices.packagedMatrix : [],
    componentMatrix,
    clientMatrix,
    toolchainMatrix: productionToolchainPlatforms(releaseChannel),
    componentChecks: componentMatrix.length > 0,
    databaseTests: matrices.databaseMatrix.length > 0,
    packageChecks: affectedOwners.length > 0,
    packageMatrix: partitionPackageChecks(affectedOwners),
    lernaFilter: affectedOwners.map((name) => `--scope ${name}`).join(" "),
    dockerBuild: production,
    harnessCli: production,
    license:
      stage !== "main" &&
      (stage !== "pull_request" || changedFiles.some((file) => ["package.json", "bun.lock"].includes(basename(file)))),
    publishedExtensions:
      stage !== "main" &&
      (shared ||
        stage !== "pull_request" ||
        code.some((file) => /^(extensions|packages\/(sdk|ui|pstdio-api-contracts))\//.test(file))),
    sdkApiReport:
      stage !== "main" &&
      (shared ||
        stage !== "pull_request" ||
        code.some((file) => /^packages\/(sdk|ui|pstdio-api-contracts)\//.test(file))),
    browserSmoke,
    deepDiagnostics: labels.includes("ci:full"),
  };
};

if (import.meta.main) {
  let profile = process.env.CI_PROFILE || undefined;
  if (!profile && process.env.GITHUB_REF?.startsWith("refs/heads/test/ci-reliability/")) {
    profile = "production";
    if (process.env.GITHUB_REF.startsWith("refs/heads/test/ci-reliability/merge/")) profile = "merge_queue";
  }
  const scope = resolveCiScope({
    event: process.env.GITHUB_EVENT_NAME ?? "",
    labels: JSON.parse(process.env.PULL_REQUEST_LABELS || "[]"),
    changedFiles: changedFiles(
      process.cwd(),
      // A PR checkout is the tested merge candidate. Event base metadata can lag
      // main; its first parent is the actual base and excludes upstream-only edits.
      process.env.GITHUB_EVENT_NAME === "pull_request" ? "HEAD^1" : undefined,
    ),
    packages: readWorkspacePackages(process.cwd()),
    tests: discoverTestFiles(process.cwd()),
    profile,
    releaseChannel: process.env.RELEASE_CHANNEL || undefined,
  });
  const outputs = Object.entries({
    ...scope,
    requiredJobs: requiredCiJobs(scope),
    gatePlan: plannedCiJobs(scope),
    coverageArtifacts: sourceCoverageArtifacts(scope, Number(process.env.GITHUB_RUN_ATTEMPT ?? 1)),
  }).map(([key, value]) => `${key}=${Array.isArray(value) ? JSON.stringify(value) : value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
  const summary = [`## CI scope (${scope.stage})`, ...outputs.map((line) => `- ${line}`)].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  console.log(summary);
}
