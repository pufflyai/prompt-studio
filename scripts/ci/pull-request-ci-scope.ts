import { appendFileSync } from "node:fs";
import { basename } from "node:path";
import { changedFiles } from "./changed-files";
import { affectedPackages } from "./ci-packages";
import { createEditedTestMatrix } from "./edited-test-matrix";
import { partitionPackageChecks } from "./package-check-matrix";
import {
  harnessCliLanes,
  productionDesktopCheckPlatforms,
  productionDesktopPlatforms,
  productionToolchainPlatforms,
  quarantineBunHosts,
} from "./production-platforms";
import { plannedCiJobs, requiredCiJobs } from "./required-ci-jobs";
import { sourceCoverageArtifacts } from "./source-coverage-artifacts";
import { discoverTestFiles, priorityFromFile } from "./test-discovery";
import { createTestMatrices } from "./test-matrices";
import type { TestPriority } from "./test-policy";
import { readWorkspacePackages } from "./workspace-packages";

interface CiScopeInput {
  event: string;
  changedFiles: string[];
  packages: ReturnType<typeof readWorkspacePackages>;
  tests: string[];
  profile?: string;
  releaseChannel?: string;
  signedCandidate?: boolean;
}
const documentation = (file: string) =>
  /\.(md|mdx|txt)$/.test(file) || file.startsWith("design/") || file === "LICENSE";

const sharedBuildInput = (file: string) =>
  file.startsWith("scripts/build/") || ["scripts/release/stage-package.ts", "scripts/test-setup.ts"].includes(file);

const stageFor = (event: string, production: boolean, profile?: string) => {
  if (production) return "full";
  // The release workflow dispatches PR checks for the Version Packages PR: its
  // token's pushes need a maintainer's approval before pull_request runs start.
  if (event === "pull_request" || profile === "pull_request") return "pull_request";
  if (event === "push" && profile !== "merge_queue") return "main";
  return "merge_queue";
};

const prioritiesFor = (stage: ReturnType<typeof stageFor>): TestPriority[] => {
  if (stage === "full") return ["P0", "P1", "P2"];
  return stage === "merge_queue" ? ["P0", "P1"] : ["P0"];
};

// These checks depend only on the files they read. A queue entry diffs against the entry ahead
// of it, which already checked its own changes, so PRs and the queue check only their own diff.
const runsFileCheck = (stage: ReturnType<typeof stageFor>, touched: boolean) =>
  stage === "full" || (stage !== "main" && touched);

export const resolveCiScope = (input: CiScopeInput) => {
  const { event, changedFiles, packages, tests, profile, releaseChannel = "stable", signedCandidate = false } = input;
  for (const file of tests) priorityFromFile(file);
  const production =
    profile === "production" ||
    (event === "workflow_dispatch" && profile !== "merge_queue" && profile !== "pull_request");
  const stage = stageFor(event, production, profile);
  const code = changedFiles.filter((file) => !documentation(file));
  const shared = code.some((file) => sharedBuildInput(file) || !packages.some((pkg) => file.startsWith(`${pkg.dir}/`)));
  let affectedOwners = affectedPackages(packages, code);
  if (shared || stage !== "pull_request") affectedOwners = packages.map((pkg) => pkg.name).sort();
  if (stage === "main") affectedOwners = [];
  const publicApi = code.some((file) => /^packages\/(sdk|ui|pstdio-api-contracts)\//.test(file));
  const extensions = code.some((file) => file.startsWith("extensions/"));
  const publishedExtensions = runsFileCheck(stage, shared || publicApi || extensions);
  // One Linux build per run feeds every host job that builds packages; each job still builds what it misses.
  const sharedBuild = affectedOwners.map((name) => `--scope ${name}`).join(" ");
  const matrices = createTestMatrices(tests, packages, affectedOwners, prioritiesFor(stage));
  const componentMatrix = stage === "merge_queue" ? [] : matrices.componentMatrix;
  const browserSmoke = stage === "main" || stage === "merge_queue";
  let clientRows = production ? productionDesktopCheckPlatforms(releaseChannel) : [];
  // Signed validation runs every packaged desktop case on the release files; here only source checks remain.
  if (production && signedCandidate)
    clientRows = productionDesktopPlatforms(releaseChannel).map((row) => ({ ...row, shard: 1, shards: 1 }));
  const clientMatrix = clientRows.map((row) => ({
    ...row,
    os: row.platform === "linux" ? "ubuntu-latest" : row.os,
    tests: true,
    packaged: !signedCandidate,
  }));
  return {
    stage,
    production,
    sourceCoverage: production && releaseChannel === "nightly",
    affectedOwners,
    // Only tests edited by the PR run beyond P0. Support files, fixtures and runners rely on
    // the affected P0 checks here and on the complete suites in nightly and stable validation.
    editedMatrix:
      stage === "pull_request"
        ? createEditedTestMatrix(
            tests.filter((file) => code.includes(file)),
            packages,
          )
        : [],
    ...matrices,
    appMatrix: production ? matrices.appMatrix : [],
    // The toolchain job runs the packaged CLI suite on every host, including Linux x64.
    packagedMatrix: production ? matrices.packagedMatrix.filter((row) => row.suite !== "cli") : [],
    componentMatrix,
    clientMatrix,
    toolchainMatrix: productionToolchainPlatforms(releaseChannel),
    windows: production && productionDesktopPlatforms(releaseChannel).some((row) => row.platform === "win32"),
    quarantineBunOs: production ? quarantineBunHosts(releaseChannel) : [],
    harnessMatrix: production ? harnessCliLanes(releaseChannel) : [],
    componentChecks: componentMatrix.length > 0,
    databaseTests: matrices.databaseMatrix.length > 0,
    packageChecks: affectedOwners.length > 0,
    packageMatrix: partitionPackageChecks(affectedOwners),
    lernaFilter: affectedOwners.map((name) => `--scope ${name}`).join(" "),
    dockerBuild: production,
    harnessCli: production,
    license: runsFileCheck(
      stage,
      changedFiles.some((file) => ["package.json", "bun.lock"].includes(basename(file))),
    ),
    publishedExtensions,
    sharedBuild,
    sdkApiReport: runsFileCheck(stage, shared || publicApi),
    browserSmoke,
  };
};

if (import.meta.main) {
  let profile = process.env.CI_PROFILE || undefined;
  // A dispatch has no PR base, so scope compares the last commit only. That is the whole
  // diff only for the version branch, which is one commit on top of main.
  if (
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
    profile === "pull_request" &&
    process.env.GITHUB_REF !== "refs/heads/changeset-release/main"
  )
    throw new Error("The pull_request profile only runs for changeset-release/main.");
  if (!profile && process.env.GITHUB_REF?.startsWith("refs/heads/test/ci-reliability/")) {
    profile = "production";
    if (process.env.GITHUB_REF.startsWith("refs/heads/test/ci-reliability/merge/")) profile = "merge_queue";
  }
  const scope = resolveCiScope({
    event: process.env.GITHUB_EVENT_NAME ?? "",
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
    signedCandidate: process.env.SIGNED_CANDIDATE === "true",
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
