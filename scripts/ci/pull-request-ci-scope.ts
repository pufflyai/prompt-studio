import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { basename, relative } from "node:path";

// Pull request runs compare the merge commit with its first parent: the target branch.
const PULL_REQUEST_BASE = "HEAD~1";

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

// The workflow runs the jobs of one stage. A pull request gets fast Linux checks, the merge
// queue builds every client and runs deterministic checks, and the full stage runs everything.
export function resolveCiScope({ event, labels, changedFiles, packageDirs, affectedPackages }: CiScopeInput) {
  if (event === "merge_group") {
    return {
      stage: "merge_queue",
      dockerBuild: true,
      relaySmoke: true,
      lernaFilter: "",
      license: false,
      publishedExtensions: false,
      harnessCli: false,
      databaseTests: false,
    };
  }
  const everyCheck = {
    dockerBuild: true,
    relaySmoke: true,
    lernaFilter: "",
    license: true,
    publishedExtensions: true,
    harnessCli: true,
    databaseTests: true,
  };
  if (event !== "pull_request" || labels.includes(FULL_RUN_LABEL)) return { stage: "full", ...everyCheck };

  // Files outside every package, such as the lockfile or workflows, can affect any package.
  if (changedFiles.some((file) => !isPackageFile(file, packageDirs) && !isDocumentation(file))) {
    return { stage: "pull_request", ...everyCheck };
  }

  return {
    stage: "pull_request",
    dockerBuild: changedFiles.some((file) => ["package.json", "bun.lock", "Dockerfile"].includes(basename(file))),
    lernaFilter: `--since ${PULL_REQUEST_BASE}`,
    relaySmoke: affectedPackages.some((name) => ["pstdio-relay", "pstdio-db", "pstdio-account-manager"].includes(name)),
    databaseTests: affectedPackages.some((name) => SHARDED_TEST_PACKAGES.includes(name)),
    publishedExtensions: changedFiles.some((file) =>
      ["extensions", "packages/sdk", "packages/ui", "packages/pstdio-api-contracts"].some((dir) => isInside(file, dir)),
    ),
    license: changedFiles.some((file) => ["bun.lock", "package.json"].includes(basename(file))),
    harnessCli: changedFiles.some((file) =>
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
  const labels: string[] = JSON.parse(process.env.PULL_REQUEST_LABELS || "[]");
  const changedFiles = run("git", ["diff", "--name-only", PULL_REQUEST_BASE, "HEAD"]).split("\n").filter(Boolean);
  const lernaPackages = (...filters: string[]) =>
    JSON.parse(run("bunx", ["lerna", "ls", "--all", "--json", "--loglevel", "silent", ...filters])) as Array<{
      name: string;
      location: string;
    }>;
  const packageDirs = lernaPackages().map((pkg) => relative(process.cwd(), pkg.location));
  const affectedPackages = lernaPackages("--since", PULL_REQUEST_BASE).map((pkg) => pkg.name);
  const scope = resolveCiScope({ event, labels, changedFiles, packageDirs, affectedPackages });

  const outputs = Object.entries(scope).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
  const summary = [`## CI scope (${event})`, ...outputs.map((line) => `- ${line}`)];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  console.log(summary.join("\n"));
}
