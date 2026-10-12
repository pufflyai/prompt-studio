import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { basename, relative } from "node:path";

// Pull request runs compare the merge commit with its first parent: the target branch.
const PULL_REQUEST_BASE = "HEAD~1";

// Repository tooling, such as the test preload and build scripts, affects every package.
const REPOSITORY_TOOLING_DIR = "scripts";

// A person adds this label to run the full after-merge suite on a pull request.
const FULL_RUN_LABEL = "ci:full";

interface CiScopeInput {
  event: string;
  labels: string[];
  changedFiles: string[];
  packageDirs: string[];
}

const isInside = (file: string, dir: string) => file.startsWith(`${dir}/`);
const isPackageFile = (file: string, packageDirs: string[]) =>
  !isInside(file, REPOSITORY_TOOLING_DIR) && packageDirs.some((dir) => isInside(file, dir));
const isDocumentation = (file: string) => file.endsWith(".md") || file.startsWith("design/") || file === "LICENSE";

// The workflow runs the jobs of one stage. A pull request gets fast Linux checks, the merge
// queue builds every client and runs deterministic checks, and the full stage runs everything.
export function resolveCiScope({ event, labels, changedFiles, packageDirs }: CiScopeInput) {
  if (event === "merge_group") {
    return { stage: "merge_queue", lernaFilter: "", license: false, publishedExtensions: false, harnessCli: false };
  }
  if (event !== "pull_request" || labels.includes(FULL_RUN_LABEL)) {
    return { stage: "full", lernaFilter: "", license: true, publishedExtensions: true, harnessCli: true };
  }

  // Files outside every package, such as the lockfile or workflows, can affect any package.
  if (changedFiles.some((file) => !isPackageFile(file, packageDirs) && !isDocumentation(file))) {
    return { stage: "pull_request", lernaFilter: "", license: true, publishedExtensions: true, harnessCli: true };
  }

  return {
    stage: "pull_request",
    lernaFilter: `--since ${PULL_REQUEST_BASE}`,
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
  const packages = JSON.parse(run("bunx", ["lerna", "ls", "--all", "--json", "--loglevel", "silent"])) as Array<{
    location: string;
  }>;
  const packageDirs = packages.map((pkg) => relative(process.cwd(), pkg.location));
  const scope = resolveCiScope({ event, labels, changedFiles, packageDirs });

  const outputs = Object.entries(scope).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
  const summary = [`## CI scope (${event})`, ...outputs.map((line) => `- ${line}`)];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  console.log(summary.join("\n"));
}
