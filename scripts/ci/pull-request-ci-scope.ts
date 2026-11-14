import { appendFileSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { changedFiles } from "./changed-files";
import { affectedPackages } from "./ci-packages";
import { createCiTestPlan } from "./ci-test-plan";
import { selectIntegrationFiles } from "./coverage-ownership";
import { integrationSourceOwners } from "./integration-source-owners";
import { partitionPackageChecks } from "./package-check-matrix";
import {
  harnessCliLanes,
  productionDesktopCheckPlatforms,
  productionToolchainPlatforms,
  quarantineBunHosts,
} from "./production-platforms";
import { plannedCiJobs, requiredCiJobs } from "./required-ci-jobs";
import { sourceCoverageArtifacts } from "./source-coverage-artifacts";
import { discoverTestFiles, priorityFromFile } from "./test-discovery";
import { testPlanSource } from "./test-plan-source";
import type { TestPriority } from "./test-policy";
import { selectCiTests, selectEditedTests } from "./test-selection";
import { compatibleTestTimings, type TestTimingSnapshot } from "./test-timing-snapshot";
import { readWorkspacePackages } from "./workspace-packages";

interface CiScopeInput {
  event: string;
  changedFiles: string[];
  packages: ReturnType<typeof readWorkspacePackages>;
  tests: string[];
  profile?: string;
  releaseChannel?: string;
  signedCandidate?: boolean;
  timingSnapshot?: TestTimingSnapshot;
  coverage?: boolean;
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
  return stage === "main" ? ["P0"] : ["P0", "P1"];
};

// PRs and merge groups apply the same policy to their actual candidate and combined diff.
const runsFileCheck = (stage: ReturnType<typeof stageFor>, touched: boolean) =>
  stage === "full" || (stage !== "main" && touched);

const coverageForScope = (input: CiScopeInput, production: boolean, channel: string) =>
  input.coverage ?? (production && channel === "nightly");

const desktopRows = (
  releaseChannel: string,
  production: boolean,
  requiredProfile: boolean,
  signedCandidate: boolean,
) => {
  let clientRows = production ? productionDesktopCheckPlatforms(releaseChannel) : [];
  if (requiredProfile)
    clientRows = [{ target: "linux-x64", os: "ubuntu-latest", platform: "linux", arch: "x64", shard: 1, shards: 1 }];
  return clientRows.map((row) => ({
    ...row,
    os: row.platform === "linux" ? "ubuntu-latest" : row.os,
    tests: production,
    packaged: !signedCandidate || (releaseChannel === "nightly" && row.platform === "win32"),
  }));
};

export const ciDiffBase = (event?: string, eventPath?: string) => {
  if (event === "merge_group") return JSON.parse(readFileSync(eventPath!, "utf8")).merge_group.base_sha as string;
  if (event === "pull_request") return "HEAD^1";
};

const productionProfile = (event: string, profile?: string) =>
  ["production", "compatibility"].includes(profile ?? "") ||
  (event === "workflow_dispatch" && profile !== "merge_queue");

const integrationOwnersFor = (packages: CiScopeInput["packages"], code: string[], all: boolean) =>
  all ? packages.map((pkg) => pkg.name) : integrationSourceOwners(packages, code);

const resolveBaseScope = (input: CiScopeInput) => {
  const { event, changedFiles, packages, tests, profile, releaseChannel = "stable", signedCandidate = false } = input;
  for (const file of tests) priorityFromFile(file);
  const production = productionProfile(event, profile);
  const stage = stageFor(event, production, profile);
  const code = changedFiles.filter((file) => !documentation(file));
  const shared = code.some((file) => sharedBuildInput(file) || !packages.some((pkg) => file.startsWith(`${pkg.dir}/`)));
  let affectedOwners = affectedPackages(packages, code);
  if (shared || production) affectedOwners = packages.map((pkg) => pkg.name).sort();
  if (stage === "main") affectedOwners = [];
  const publicApi = code.some((file) => /^packages\/(sdk|ui|pstdio-api-contracts)\//.test(file));
  const extensions = code.some((file) => file.startsWith("extensions/"));
  const publishedExtensions = runsFileCheck(stage, shared || publicApi || extensions);
  // One Linux build per run feeds every host job that builds packages; each job still builds what it misses.
  const sharedBuild = affectedOwners.map((name) => `--scope ${name}`).join(" ");
  const integrationOwners = integrationOwnersFor(packages, code, shared || production);
  const coverage = coverageForScope(input, production, releaseChannel);
  const requiredProfile = stage === "pull_request" || stage === "merge_queue";
  const checkOwners = requiredProfile ? packages.map((pkg) => pkg.name).sort() : affectedOwners;
  const matrices = selectCiTests(tests, packages, affectedOwners, prioritiesFor(stage), input.timingSnapshot, coverage);
  if (requiredProfile) {
    const baseline = selectCiTests(tests, packages, checkOwners, ["P0"], input.timingSnapshot, coverage);
    matrices.databaseMatrix = [
      ...baseline.databaseMatrix,
      ...matrices.databaseMatrix.filter((row) => row.priority !== "P0"),
    ];
    matrices.integrationMatrix = [
      ...baseline.integrationMatrix,
      ...matrices.integrationMatrix.filter((row) => row.priority !== "P0"),
    ];
  }
  const affectedIntegrations = requiredProfile
    ? selectCiTests(
        selectIntegrationFiles(
          tests.filter((file) => file.startsWith("packages/e2e/src/packaged/")),
          { platform: "linux", arch: "x64" },
          { changed: code, owners: integrationOwners },
        ),
        packages,
        packages.map((pkg) => pkg.name),
        ["P1", "P2"],
        input.timingSnapshot,
      ).packagedMatrix
    : [];
  const componentMatrix = production ? matrices.componentMatrix : [];
  const browserSmoke = !production;
  const clientMatrix = desktopRows(releaseChannel, production, requiredProfile, signedCandidate);
  return {
    stage,
    production,
    changedFiles,
    requiredProfile,
    sourceCoverage: production && releaseChannel === "nightly",
    affectedOwners,
    integrationOwners,
    // Both gates include edited behavior tests; platform diagnostics remain outside the universal Linux profile.
    editedMatrix: requiredProfile
      ? selectEditedTests(
          tests.filter(
            (file) => code.includes(file) && priorityFromFile(file) !== "P3" && !file.startsWith("clients/desktop/"),
          ),
          packages,
        ).filter((row) => row.platform === "linux")
      : [],
    ...matrices,
    appMatrix: production ? matrices.appMatrix : [],
    // Shared CLI journeys have one Linux owner; native toolchain rows consume only their contracts.
    packagedMatrix: production ? matrices.packagedMatrix : affectedIntegrations,
    componentMatrix,
    clientMatrix,
    toolchainMatrix: production ? productionToolchainPlatforms(releaseChannel) : [],
    windows: production && clientMatrix.some((row) => row.platform === "win32"),
    quarantineBunOs: production ? quarantineBunHosts(releaseChannel) : [],
    harnessMatrix: production ? harnessCliLanes(releaseChannel) : [],
    componentChecks: componentMatrix.length > 0,
    databaseTests: matrices.databaseMatrix.length > 0,
    packageChecks: checkOwners.length > 0,
    packageMatrix: partitionPackageChecks(
      checkOwners,
      4,
      compatibleTestTimings(input.timingSnapshot, {
        kind: "package",
        profile: "package-checks",
        host: "linux/x64",
        configuration: "source:stable:P0",
        coverage,
      }),
    ),
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

export const resolveCiScope = (input: CiScopeInput) => {
  const windowsOnly = input.profile === "windows";
  if (windowsOnly && input.signedCandidate)
    throw new Error("Windows diagnostics cannot certify a signed release candidate");
  if (windowsOnly && input.releaseChannel && input.releaseChannel !== "stable")
    throw new Error("Windows diagnostics require the stable Windows lanes");
  const scope = resolveBaseScope(windowsOnly ? { ...input, profile: "production" } : input);
  if (input.profile === "compatibility")
    return {
      ...scope,
      windowsOnly: false,
      affectedOwners: [],
      packageChecks: false,
      packageMatrix: [],
      lernaFilter: "",
      sharedBuild: "",
      databaseTests: false,
      databaseMatrix: [],
      integrationMatrix: [],
      bunContractMatrix: [],
      componentChecks: false,
      componentMatrix: [],
      appMatrix: [],
      packagedMatrix: [],
      clientMatrix: scope.clientMatrix
        .filter((row) => row.target === "darwin-x64")
        .map((row) => ({ ...row, tests: false })),
      toolchainMatrix: scope.toolchainMatrix.filter((row) =>
        ["cli-linux-arm64", "cli-darwin-x64", "cli-win-arm64"].includes(row.platform_pkg),
      ),
      quarantineBunOs: [],
      harnessMatrix: [],
      windows: false,
      harnessCli: false,
      dockerBuild: false,
      license: false,
      publishedExtensions: false,
      sdkApiReport: false,
    };
  if (!windowsOnly) return { ...scope, windowsOnly };
  // Reuse complete stable Windows lanes, including their shards and quarantine evidence.
  // This source diagnostic is separate from both the PR gate and signed release certification.
  return {
    ...scope,
    windowsOnly,
    affectedOwners: [],
    packageChecks: false,
    packageMatrix: [],
    lernaFilter: "",
    sharedBuild: "",
    databaseTests: false,
    databaseMatrix: [],
    integrationMatrix: [],
    bunContractMatrix: [],
    componentChecks: false,
    componentMatrix: [],
    appMatrix: [],
    packagedMatrix: [],
    clientMatrix: scope.clientMatrix.filter((row) => row.platform === "win32"),
    toolchainMatrix: scope.toolchainMatrix.filter((row) => row.platform_pkg.startsWith("cli-win-")),
    quarantineBunOs: scope.quarantineBunOs.filter((os) => os.startsWith("windows")),
    harnessMatrix: scope.harnessMatrix.filter(
      (row) => "os" in row && typeof row.os === "string" && row.os.startsWith("windows"),
    ),
    dockerBuild: false,
    license: false,
    publishedExtensions: false,
    sdkApiReport: false,
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
    changedFiles: changedFiles(process.cwd(), ciDiffBase(process.env.GITHUB_EVENT_NAME, process.env.GITHUB_EVENT_PATH)),
    packages: readWorkspacePackages(process.cwd()),
    tests: discoverTestFiles(process.cwd()),
    profile,
    releaseChannel: process.env.RELEASE_CHANNEL || undefined,
    signedCandidate: process.env.SIGNED_CANDIDATE === "true",
  });
  const packages = readWorkspacePackages(process.cwd()).map((pkg) => ({ ...pkg, scripts: {} }));
  const plan = createCiTestPlan(scope, packages, discoverTestFiles(process.cwd()), testPlanSource(process.cwd()));
  await Bun.write("test-results/ci/plan.json", JSON.stringify(plan, null, 2));
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
