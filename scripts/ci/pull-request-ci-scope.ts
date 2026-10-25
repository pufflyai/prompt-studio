import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { basename } from "node:path";
import { allBrowserChecks, selectBrowserChecks } from "./browser-checks";
import { affectedPackages as selectAffectedPackages } from "./ci-packages";
import { allComponentChecks, componentShardCount, selectComponentChecks } from "./component-checks";
import { partitionFocusedFiles, selectFocusedTestFiles } from "./focused-test-files";
import { partitionPackageChecks } from "./package-check-matrix";
import { plannedCiJobs, requiredCiJobs } from "./required-ci-jobs";
import { readWorkspacePackages } from "./workspace-packages";

// Repository tooling, such as the test preload and build scripts, affects every package.
const REPOSITORY_TOOLING_DIR = "scripts";

// A person adds this label to run the full suite on a pull request before it reaches the queue.
const FULL_RUN_LABEL = "ci:full";

// Their test suites take minutes, so they run in sharded jobs of their own.
const SHARDED_TEST_PACKAGES = ["pstdio-api", "pstdio-db"];

interface CiScopeInput {
  event: string;
  labels: string[];
  changedFiles: string[];
  packageDirs: string[];
  // Packages changed since the target branch and their dependents.
  affectedPackages: string[];
  workspacePackages: string[];
  profile?: string;
}

const isInside = (file: string, dir: string) => file.startsWith(`${dir}/`);
const isPackageFile = (file: string, packageDirs: string[]) =>
  !isInside(file, REPOSITORY_TOOLING_DIR) && packageDirs.some((dir) => isInside(file, dir));
const isDocumentation = (file: string) => file.endsWith(".md") || file.startsWith("design/") || file === "LICENSE";

// PRs select affected essentials. The queue covers supported nightly platforms;
// production adds Windows and complete release permutations.
function selectCiScope({ event, labels, changedFiles, packageDirs, affectedPackages, profile }: CiScopeInput) {
  const componentSelection = selectComponentChecks(changedFiles);
  const production = profile === "production" || (event === "workflow_dispatch" && profile !== "merge_queue");
  const everyCheck = {
    dockerBuild: true,
    relaySmoke: true,
    lernaFilter: "",
    license: true,
    publishedExtensions: true,
    harnessCli: true,
    databaseTests: true,
    browserSmoke: true,
    browserChecks: allBrowserChecks,
    packageChecks: true,
    componentChecks: true,
    componentFiles: allComponentChecks.map((file) => `src/ui/${file}`),
    componentReasons: ["complete merge-critical component suite"],
    componentShards: componentShardCount(allComponentChecks),
    sdkApiReport: true,
    production,
    deepDiagnostics: labels.includes(FULL_RUN_LABEL),
  };
  if (event === "push" && !production && profile !== "merge_queue") {
    return {
      ...everyCheck,
      stage: "main",
      dockerBuild: false,
      relaySmoke: false,
      license: false,
      publishedExtensions: false,
      harnessCli: false,
      databaseTests: false,
      browserSmoke: true,
      browserChecks: [] as string[],
      packageChecks: false,
      componentChecks: false,
      componentFiles: [] as string[],
      componentReasons: [] as string[],
      componentShards: 0,
      sdkApiReport: false,
    };
  }
  if (event !== "pull_request" || production) {
    // Full UI and Windows suites already include these targeted checks.
    return {
      stage: production ? "full" : "merge_queue",
      ...everyCheck,
      dockerBuild: production,
      harnessCli: production,
      browserSmoke: false,
      browserChecks: [] as string[],
    };
  }
  const stage = "pull_request";

  // Files outside every package, such as the lockfile or workflows, can affect any package.
  if (changedFiles.some((file) => !isPackageFile(file, packageDirs) && !isDocumentation(file))) {
    return {
      stage,
      ...everyCheck,
      dockerBuild: false,
      relaySmoke: false,
      harnessCli: false,
      componentChecks: componentSelection.files.length > 0,
      componentFiles: componentSelection.files,
      componentReasons: componentSelection.reasons,
      componentShards: componentShardCount(componentSelection.files),
    };
  }

  // Prose selects link/source checks without starting runtime suites.
  const changedCode = changedFiles.filter((file) => !isDocumentation(file));
  const browserSmoke =
    changedCode.some((file) => ["packages/pstdio-dashboard", "packages/e2e"].some((dir) => isInside(file, dir))) ||
    (changedCode.length > 0 && affectedPackages.some((name) => ["pstdio-dashboard", "e2e"].includes(name)));

  return {
    stage,
    production,
    deepDiagnostics: labels.includes(FULL_RUN_LABEL),
    componentChecks: componentSelection.files.length > 0,
    componentFiles: componentSelection.files,
    componentReasons: componentSelection.reasons,
    componentShards: componentShardCount(componentSelection.files),
    sdkApiReport: changedCode.some((file) => /^(packages\/(sdk|ui|pstdio-api-contracts)|scripts\/verify)\//.test(file)),
    browserSmoke,
    browserChecks: selectBrowserChecks(changedCode, browserSmoke),
    // E2E has no lint target and the unit job excludes it from its package filter.
    packageChecks: changedCode.length > 0 && affectedPackages.some((name) => name !== "e2e"),
    dockerBuild: false,
    lernaFilter: affectedPackages.map((name) => `--scope ${name}`).join(" "),
    relaySmoke: false,
    databaseTests: changedCode.some((file) => SHARDED_TEST_PACKAGES.some((name) => isInside(file, `packages/${name}`))),
    publishedExtensions: changedCode.some((file) =>
      ["extensions", "packages/sdk", "packages/ui", "packages/pstdio-api-contracts"].some((dir) => isInside(file, dir)),
    ),
    license: changedFiles.some((file) => ["bun.lock", "package.json"].includes(basename(file))),
    harnessCli: false,
  };
}

export function resolveCiScope(input: CiScopeInput) {
  const scope = selectCiScope(input);
  const selected = scope.lernaFilter ? input.affectedPackages : input.workspacePackages;
  if (scope.packageChecks && selected.length === 0)
    throw new Error("Package checks require at least one selected workspace owner");
  return { ...scope, packageMatrix: partitionPackageChecks(scope.packageChecks ? selected : []) };
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout;
}

if (import.meta.main) {
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  let profile = process.env.CI_PROFILE || undefined;
  if (!profile && process.env.GITHUB_REF?.startsWith("refs/heads/test/ci-reliability/")) {
    profile = "production";
    if (process.env.GITHUB_REF.startsWith("refs/heads/test/ci-reliability/merge/")) profile = "merge_queue";
  }
  // A pull request is checked out as its merge commit, so its first parent is the target branch. Other
  // events run every check and ignore the diff.
  const changedFiles = run("git", ["diff", "--name-only", "--no-renames", "HEAD~1", "HEAD"])
    .split("\n")
    .filter(Boolean);
  const labels: string[] = JSON.parse(process.env.PULL_REQUEST_LABELS || "[]");
  const packages = readWorkspacePackages(process.cwd());
  const packageDirs = packages.map((pkg) => pkg.dir);
  const affectedPackages = selectAffectedPackages(packages, changedFiles);
  const scope = resolveCiScope({
    event,
    labels,
    changedFiles,
    packageDirs,
    affectedPackages,
    workspacePackages: packages.map((pkg) => pkg.name),
    profile,
  });
  const databaseMatrix =
    scope.stage === "pull_request"
      ? SHARDED_TEST_PACKAGES.map((name) => ({
          package: name,
          ...selectFocusedTestFiles(process.cwd(), `packages/${name}`, changedFiles),
        }))
          .filter((selection) => selection.files.length > 0)
          .flatMap((selection) => {
            // API's 403 files summed to 393.6s with two workers. DB's sequential
            // 67 files took 273s in run 40145617723, about 4s/file. Use separate
            // scheduling thresholds while retaining the complete queue's shard caps.
            const scheduling =
              selection.package === "pstdio-api"
                ? { maxShards: 4, targetFilesPerRow: 100 }
                : { maxShards: 3, targetFilesPerRow: 25 };
            const rows = partitionFocusedFiles(selection.files, scheduling.maxShards, scheduling.targetFilesPerRow);
            return rows.map((files, index) => ({
              package: selection.package,
              shard: `${index + 1}/${rows.length}`,
              files: JSON.stringify(files),
              reason: selection.reason,
            }));
          })
      : SHARDED_TEST_PACKAGES.flatMap((name) => {
          const total = name === "pstdio-api" ? 4 : 3;
          return Array.from({ length: total }, (_, index) => ({
            package: name,
            shard: `${index + 1}/${total}`,
            files: "[]",
            reason: "complete merge-critical suite",
          }));
        });
  if (scope.stage !== "main") scope.databaseTests = databaseMatrix.length > 0;

  const outputs = Object.entries(scope).map(
    ([key, value]) => `${key}=${Array.isArray(value) ? JSON.stringify(value) : value}`,
  );
  const browserMatrix = [];
  for (let index = 0; index < scope.browserChecks.length; index += 2) {
    browserMatrix.push({
      shard: index / 2 + 1,
      specs: scope.browserChecks
        .slice(index, index + 2)
        .map((spec) => `src/ui/${spec}`)
        .join(" "),
    });
  }
  outputs.push(`browserMatrix=${JSON.stringify(browserMatrix)}`);
  outputs.push(`requiredJobs=${JSON.stringify(requiredCiJobs(scope))}`);
  outputs.push(`gatePlan=${JSON.stringify(plannedCiJobs(scope, databaseMatrix))}`);
  outputs.push(`databaseMatrix=${JSON.stringify(databaseMatrix)}`);
  outputs.push(
    `clientMatrix=${JSON.stringify([
      { target: "linux-x64", os: "ubuntu-latest", platform: "linux", arch: "x64", tests: true },
      { target: "darwin-arm64", os: "macos-15", platform: "darwin", arch: "arm64", tests: true },
      { target: "darwin-x64", os: "macos-15-intel", platform: "darwin", arch: "x64", tests: true },
      ...(scope.production
        ? [{ target: "win32-x64", os: "windows-2025", platform: "win32", arch: "x64", tests: true }]
        : []),
    ])}`,
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
  const summary = [`## CI scope (${event})`, ...outputs.map((line) => `- ${line}`)];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  console.log(summary.join("\n"));
}
