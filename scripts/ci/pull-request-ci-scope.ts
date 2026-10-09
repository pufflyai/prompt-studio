import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { basename, relative } from "node:path";

// Pull request runs compare the merge commit with its first parent: the target branch.
const PULL_REQUEST_BASE = "HEAD~1";

// Repository tooling, such as the test preload and build scripts, affects every package.
const REPOSITORY_TOOLING_DIR = "scripts";

// Packages that do filesystem or process work, where Windows behaves differently.
// A change to one of their dependencies can break them on Windows too.
const WINDOWS_SENSITIVE_PACKAGES = [
  "@pstdio/desktop",
  "harness-codex",
  "harness-open-code",
  "harness-claude-code",
  "pstdio",
  "pstdio-api",
  "pstdio-api-runtime-host",
  "pstdio-db",
  "pstdio-dev",
  "pstdio-extensions",
  "pstdio-paths",
  "pstdio-storage",
  "pstdio-wt",
];

interface CiScopeInput {
  event: string;
  changedFiles: string[];
  packageDirs: string[];
  affectedPackages: string[];
}

const isInside = (file: string, dir: string) => file.startsWith(`${dir}/`);
const isPackageFile = (file: string, packageDirs: string[]) =>
  !isInside(file, REPOSITORY_TOOLING_DIR) && packageDirs.some((dir) => isInside(file, dir));
const isDocumentation = (file: string) => file.endsWith(".md") || file.startsWith("design/") || file === "LICENSE";

export function resolveCiScope({ event, changedFiles, packageDirs, affectedPackages }: CiScopeInput) {
  // Only pull requests are narrowed. Every commit on main is tested in full.
  // Files outside every package, such as the lockfile or workflows, can affect any job.
  const full =
    event !== "pull_request" ||
    changedFiles.some((file) => !isPackageFile(file, packageDirs) && !isDocumentation(file));
  if (full)
    return { lernaFilter: "", windows: true, e2e: true, license: true, publishedExtensions: true, harnessCli: true };

  return {
    lernaFilter: `--since ${PULL_REQUEST_BASE}`,
    windows: affectedPackages.some((name) => WINDOWS_SENSITIVE_PACKAGES.includes(name)),
    e2e: affectedPackages.includes("e2e"),
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

const lernaPackages = (...filters: string[]) =>
  JSON.parse(run("bunx", ["lerna", "ls", "--all", "--json", "--loglevel", "silent", ...filters])) as Array<{
    name: string;
    location: string;
  }>;

if (import.meta.main) {
  const event = process.env.GITHUB_EVENT_NAME ?? "";
  const changedFiles = run("git", ["diff", "--name-only", PULL_REQUEST_BASE, "HEAD"]).split("\n").filter(Boolean);
  const packageDirs = lernaPackages().map((pkg) => relative(process.cwd(), pkg.location));
  const affectedPackages = lernaPackages("--since", PULL_REQUEST_BASE).map((pkg) => pkg.name);
  const scope = resolveCiScope({ event, changedFiles, packageDirs, affectedPackages });

  const outputs = Object.entries(scope).map(([key, value]) => `${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join("\n")}\n`);
  const summary = [
    `## CI scope (${event})`,
    ...outputs.map((line) => `- ${line}`),
    "",
    `Affected packages: ${affectedPackages.join(", ") || "none"}`,
  ];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  console.log(summary.join("\n"));
}
