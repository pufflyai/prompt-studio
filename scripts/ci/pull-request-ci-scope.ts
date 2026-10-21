import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { basename, relative } from "node:path";
import { allBrowserChecks, selectBrowserChecks } from "./browser-checks";
import { ciBase, readQueueChanges } from "./ci-event";
import { affectedPackages as selectAffectedPackages } from "./ci-packages";
import { requiredCiJobs } from "./required-ci-jobs";

// Repository tooling, such as the test preload and build scripts, affects every package.
const REPOSITORY_TOOLING_DIR = "scripts";

// A person adds this label to run the full after-merge suite on a pull request.
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
}

const isInside = (file: string, dir: string) => file.startsWith(`${dir}/`);
const isPackageFile = (file: string, packageDirs: string[]) =>
  !isInside(file, REPOSITORY_TOOLING_DIR) && packageDirs.some((dir) => isInside(file, dir));
const isDocumentation = (file: string) => file.endsWith(".md") || file.startsWith("design/") || file === "LICENSE";

// PRs and merge groups share one selection policy. Full runs remain available through ci:full.
export function resolveCiScope({ event, labels, changedFiles, packageDirs, affectedPackages }: CiScopeInput) {
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
    nativeChecks: ["filesystem", "process", "desktop"],
    packageChecks: true,
  };
  if (!["pull_request", "merge_group"].includes(event) || labels.includes(FULL_RUN_LABEL)) {
    // Full UI and Windows suites already include these targeted checks.
    return { stage: "full", ...everyCheck, browserChecks: [] as string[], nativeChecks: [] as string[] };
  }
  const stage = event === "merge_group" ? "merge_queue" : "pull_request";

  // Files outside every package, such as the lockfile or workflows, can affect any package.
  if (changedFiles.some((file) => !isPackageFile(file, packageDirs) && !isDocumentation(file))) {
    return { stage, ...everyCheck };
  }

  // Prose cannot change how an extension compiles or detects a CLI. The changed package still runs its own tests,
  // and static_checks validates every documentation link.
  const changedCode = changedFiles.filter((file) => !isDocumentation(file));
  const browserSmoke =
    changedCode.some((file) => ["packages/pstdio-dashboard", "packages/e2e"].some((dir) => isInside(file, dir))) ||
    (changedCode.length > 0 && affectedPackages.some((name) => ["pstdio-dashboard", "e2e"].includes(name)));
  const nativeChecks = new Set<string>();
  for (const file of changedCode) {
    if (/^clients\/desktop\//.test(file)) nativeChecks.add("desktop");
    if (/^extensions\/harness-|^packages\/pstdio(?:-api|-api-runtime-host)?\//.test(file)) nativeChecks.add("process");
    if (/^packages\/pstdio-(?:db|extensions|storage|paths|wt)\//.test(file)) nativeChecks.add("filesystem");
    if (/^packages\/(sdk|pstdio-api-contracts)\//.test(file)) {
      nativeChecks.add("filesystem");
      nativeChecks.add("process");
    }
  }

  return {
    stage,
    browserSmoke,
    browserChecks: selectBrowserChecks(changedCode, browserSmoke),
    nativeChecks: [...nativeChecks].sort(),
    // E2E has no lint target and the unit job excludes it from its package filter.
    packageChecks: affectedPackages.some((name) => name !== "e2e"),
    dockerBuild: changedFiles.some((file) => ["package.json", "bun.lock", "Dockerfile"].includes(basename(file))),
    lernaFilter: affectedPackages.map((name) => `--scope ${name}`).join(" "),
    relaySmoke: affectedPackages.some((name) => ["pstdio-relay", "pstdio-db", "pstdio-account-manager"].includes(name)),
    databaseTests: affectedPackages.some((name) => SHARDED_TEST_PACKAGES.includes(name)),
    publishedExtensions: changedCode.some((file) =>
      ["extensions", "packages/sdk", "packages/ui", "packages/pstdio-api-contracts"].some((dir) => isInside(file, dir)),
    ),
    license: changedFiles.some((file) => ["bun.lock", "package.json"].includes(basename(file))),
    harnessCli: changedCode.some((file) =>
      ["extensions/harness-codex", "extensions/harness-claude-code", "extensions/harness-open-code"].some((dir) =>
        isInside(file, dir),
      ),
    ),
  };
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout;
}

if (import.meta.main) {
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  const payload = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {};
  const base = ciBase(event, payload);
  const changedFiles = run("git", ["diff", "--name-only", "--no-renames", base, "HEAD"]).split("\n").filter(Boolean);
  let labels: string[] = JSON.parse(process.env.PULL_REQUEST_LABELS || "[]");
  if (event === "merge_group") {
    const commits = new Set(
      run("git", ["rev-list", `${base}..HEAD`])
        .split("\n")
        .filter(Boolean),
    );
    const queued = await readQueueChanges(payload, commits);
    labels = queued.labels;
    changedFiles.push(...queued.changedFiles);
  }
  const lernaPackages = (...filters: string[]) =>
    JSON.parse(run("bunx", ["lerna", "ls", "--all", "--json", "--loglevel", "silent", ...filters])) as Array<{
      name: string;
      location: string;
    }>;
  const packages = lernaPackages().map((pkg) => {
    const manifest = JSON.parse(readFileSync(`${pkg.location}/package.json`, "utf8"));
    return {
      name: pkg.name,
      dir: relative(process.cwd(), pkg.location),
      dependencies: [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.devDependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
        ...(manifest.nx?.implicitDependencies ?? []),
      ],
    };
  });
  const packageDirs = packages.map((pkg) => pkg.dir);
  const affectedPackages = selectAffectedPackages(packages, changedFiles);
  const scope = resolveCiScope({ event, labels, changedFiles, packageDirs, affectedPackages });

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
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
  const summary = [`## CI scope (${event})`, ...outputs.map((line) => `- ${line}`)];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  console.log(summary.join("\n"));
}
