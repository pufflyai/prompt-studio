// Wraps `docker compose -f infra/local/compose.yaml` with the host paths the file
// requires (HOST_WORKTREE, HOST_GIT_COMMON_DIR), assigns a unique compose project
// name so multiple instances can run in parallel, and prints the dashboard URL once
// the stack is up.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const COMPOSE_FILE = "infra/local/compose.yaml";
const PROJECT_PREFIX = "pstdio-cmp";
const SERVICE = "prompt-studio";
const CONTAINER_DASHBOARD_PORT = 5173;

const usage = `Usage:
  bun run dev:isolated                          # build + up; prints dashboard URL
  bun run dev:isolated -- --name <id>           # pin a stable compose project name
  bun run dev:isolated -- --down                # tear the stack down (incl. volumes)
  bun run dev:isolated -- --logs                # follow logs

Multiple instances: each --name produces an independent stack with its own ports,
state volumes, and demo project. Omit --name to get a random suffix.`;

const parseFlagValue = (args: string[], flag: string) => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag) return args[index + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(`${flag}=`.length);
  }
  return undefined;
};

const hasFlag = (args: string[], flag: string) => args.includes(flag);

// `git rev-parse --git-common-dir` resolves to the right path even inside a worktree,
// where .git is a file pointing at the shared common dir.
const resolveGitCommonDir = (cwd: string) => {
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git rev-parse failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
};

const composeEnv = (repoRoot: string) => ({
  ...process.env,
  HOST_WORKTREE: repoRoot,
  HOST_GIT_COMMON_DIR: resolveGitCommonDir(repoRoot),
});

const runCompose = (projectName: string, repoRoot: string, extraArgs: string[]) => {
  const result = spawnSync("docker", ["compose", "-f", COMPOSE_FILE, "-p", projectName, ...extraArgs], {
    cwd: repoRoot,
    env: composeEnv(repoRoot),
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const lookupHostPort = (projectName: string, repoRoot: string) => {
  const result = spawnSync(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "-p", projectName, "port", SERVICE, String(CONTAINER_DASHBOARD_PORT)],
    { cwd: repoRoot, env: composeEnv(repoRoot), encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`docker compose port failed: ${result.stderr.trim()}`);
  }
  const port = Number.parseInt(result.stdout.trim().split(":").pop() ?? "", 10);
  if (!Number.isInteger(port)) throw new Error(`Could not parse host port from "${result.stdout}"`);
  return port;
};

const main = () => {
  const args = process.argv.slice(2);

  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const repoRoot = resolve(import.meta.dir, "..");
  const projectName = parseFlagValue(args, "--name") ?? `${PROJECT_PREFIX}-${randomBytes(2).toString("hex")}`;

  if (hasFlag(args, "--down")) {
    runCompose(projectName, repoRoot, ["down", "-v"]);
    return;
  }

  if (hasFlag(args, "--logs")) {
    runCompose(projectName, repoRoot, ["logs", "-f", SERVICE]);
    return;
  }

  runCompose(projectName, repoRoot, ["up", "-d", "--build"]);

  const port = lookupHostPort(projectName, repoRoot);
  process.stdout.write(`\nStack:     ${projectName}\n`);
  process.stdout.write(`Dashboard: http://localhost:${port}/\n`);
  process.stdout.write(`Logs:      bun run dev:isolated -- --name ${projectName} --logs\n`);
  process.stdout.write(`Stop:      bun run dev:isolated -- --name ${projectName} --down\n`);
};

if (import.meta.main) {
  main();
}
