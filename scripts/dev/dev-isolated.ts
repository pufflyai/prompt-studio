// Wraps `docker compose -f infra/local/compose.yaml` with the host paths the file
// requires (HOST_WORKTREE, HOST_GIT_COMMON_DIR), assigns a unique compose project
// name so multiple instances can run in parallel, and prints the dashboard URL once
// the stack is up.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, posix, resolve } from "node:path";
import { readRuntimeToken, waitForRuntimeDescriptor } from "./desktop-runtime-startup";
import { resolveCredentialMounts, writeCredentialComposeFile, writeExtraCaContext } from "./isolated-host-files";
import { resolveIsolatedUser } from "./isolated-user";
import { seedLargeProject } from "./seed-large-project";
import { resolveWorkingTreeDefaultExtensions } from "./working-tree-extensions";

const COMPOSE_FILE = "infra/local/compose.yaml";
const CREDENTIALS_COMPOSE_FILE = "credentials.compose.json";
const composeFiles = (repoRoot: string, projectName: string) => {
  const credentials = join(resolveStackDirectory(repoRoot, projectName), CREDENTIALS_COMPOSE_FILE);
  return [
    "-f",
    COMPOSE_FILE,
    ...(process.env.PSTDIO_ISOLATED_COMPOSE_FILE ? ["-f", process.env.PSTDIO_ISOLATED_COMPOSE_FILE] : []),
    ...(existsSync(credentials) ? ["-f", credentials] : []),
  ];
};
const PROJECT_PREFIX = "pstdio-cmp";
const SERVICE = "prompt-studio";
const CONTAINER_DASHBOARD_PORT = 5173;
const CONTAINER_API_PORT = 19841;
const SEEDED_PROJECT_NAME = "project";
const ISOLATED_BROWSER_HOST = "127.0.0.1";
const WINDOWS_CONTAINER_WORKTREE = "/workspace/prompt-studio";
const WINDOWS_CONTAINER_GIT_COMMON_DIR = "/workspace/git-common";

const usage = `Usage:
  bun run dev:isolated                          # build + up; prints dashboard URL
  bun run dev:isolated -- --name <id>           # pin a stable compose project name
  bun run dev:isolated -- --down                # tear the stack down (incl. volumes)
  bun run dev:isolated -- --logs                # follow logs
  bun run dev:isolated -- --desktop             # unified runtime for Electron development
  bun run dev:isolated -- --large               # also seed large connected projects

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

interface HostPorts {
  dashboard: number;
  api: number;
}

export const resolveContainerPorts = (hostPorts: HostPorts, desktopMode: boolean) => ({
  dashboard: CONTAINER_DASHBOARD_PORT,
  api: desktopMode ? hostPorts.api : CONTAINER_API_PORT,
});

const resolveStackDirectory = (repoRoot: string, projectName: string) => {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(projectName)) {
    throw new Error(`Invalid isolated stack name: ${projectName}`);
  }
  return resolve(repoRoot, "__test-tmp__", "dev-isolated", projectName);
};

export const resolveIsolatedHome = (repoRoot: string, projectName: string) =>
  join(resolveStackDirectory(repoRoot, projectName), "pstdio-home");

export const resolveIsolatedDashboardUrl = (port: number) => `http://${ISOLATED_BROWSER_HOST}:${port}/`;

export const resolveIsolatedDefaultExtensions = (
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
) =>
  env.PSTDIO_DEFAULT_EXTENSIONS ??
  JSON.stringify(
    resolveWorkingTreeDefaultExtensions(platform === "win32" ? WINDOWS_CONTAINER_WORKTREE : repoRoot, posix.resolve),
  );

export const resolveIsolatedExtensionReleaseRef = (
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
) => {
  if (env.PSTDIO_EXTENSION_RELEASE_REF) return env.PSTDIO_EXTENSION_RELEASE_REF;
  const manifest = JSON.parse(readFile(resolve(repoRoot, "packages/pstdio/package.json"))) as { version?: unknown };
  if (typeof manifest.version !== "string" || !manifest.version) {
    throw new Error("packages/pstdio/package.json does not provide a version");
  }
  return `pstdio@${manifest.version}`;
};
export const composeMountPaths = ({
  gitCommonDir,
  platform = process.platform,
  repoRoot,
}: {
  gitCommonDir: string;
  platform?: NodeJS.Platform;
  repoRoot: string;
}) => ({
  CONTAINER_GIT_COMMON_DIR: platform === "win32" ? WINDOWS_CONTAINER_GIT_COMMON_DIR : gitCommonDir,
  CONTAINER_WORKTREE: platform === "win32" ? WINDOWS_CONTAINER_WORKTREE : repoRoot,
  HOST_GIT_COMMON_DIR: gitCommonDir,
  HOST_WORKTREE: repoRoot,
});
const composeEnv = (
  repoRoot: string,
  projectName: string,
  hostPorts?: HostPorts,
  desktopMode = false,
  apiToken?: string,
) => ({
  ...process.env,
  ...(process.env.PSTDIO_ISOLATED_AGENT_CREDENTIALS === "0"
    ? { ANTHROPIC_API_KEY: "", CLAUDE_CODE_OAUTH_TOKEN: "" }
    : {}),
  ...(apiToken ? { PSTDIO_ISOLATED_API_TOKEN: apiToken } : {}),
  ...resolveIsolatedUser(),
  HOME: process.env.HOME ?? process.env.USERPROFILE,
  ...composeMountPaths({
    gitCommonDir: resolveGitCommonDir(repoRoot),
    repoRoot,
  }),
  HOST_PSTDIO_HOME: resolveIsolatedHome(repoRoot, projectName),
  PSTDIO_ISOLATED_CA_DIR: join(resolveStackDirectory(repoRoot, projectName), "extra-ca"),
  PSTDIO_DEFAULT_EXTENSIONS: resolveIsolatedDefaultExtensions(repoRoot),
  PSTDIO_EXTENSION_RELEASE_REF: resolveIsolatedExtensionReleaseRef(repoRoot),
  PSTDIO_DESKTOP_FLOW: desktopMode ? "1" : "0",
  ...(hostPorts
    ? {
        HOST_DASHBOARD_PORT: String(hostPorts.dashboard),
        HOST_API_PORT: String(hostPorts.api),
        CONTAINER_API_PORT: String(resolveContainerPorts(hostPorts, desktopMode).api),
      }
    : {}),
});

const runCompose = (
  projectName: string,
  repoRoot: string,
  extraArgs: string[],
  hostPorts?: HostPorts,
  desktopMode = false,
  apiToken?: string,
) => {
  const result = spawnSync(
    "docker",
    ["compose", ...composeFiles(repoRoot, projectName), "-p", projectName, ...extraArgs],
    {
      cwd: repoRoot,
      env: composeEnv(repoRoot, projectName, hostPorts, desktopMode, apiToken),
      stdio: "inherit",
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const lookupHostPort = (
  projectName: string,
  repoRoot: string,
  containerPort: number,
  hostPorts: HostPorts,
  desktopMode: boolean,
) => {
  const result = spawnSync(
    "docker",
    ["compose", ...composeFiles(repoRoot, projectName), "-p", projectName, "port", SERVICE, String(containerPort)],
    { cwd: repoRoot, env: composeEnv(repoRoot, projectName, hostPorts, desktopMode), encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`docker compose port failed: ${result.stderr.trim()}`);
  }
  const port = Number.parseInt(result.stdout.trim().split(":").pop() ?? "", 10);
  if (!Number.isInteger(port)) throw new Error(`Could not parse host port from "${result.stdout}"`);
  return port;
};

const reserveHostPort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve an isolated host port."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });

const reserveHostPorts = async (): Promise<HostPorts> => {
  const [dashboard, api] = await Promise.all([reserveHostPort(), reserveHostPort()]);
  if (dashboard !== api) return { dashboard, api };
  return { dashboard, api: await reserveHostPort() };
};

const createComposeServiceMonitor = (
  projectName: string,
  repoRoot: string,
  hostPorts: HostPorts,
  desktopMode: boolean,
) => {
  const args = ["compose", ...composeFiles(repoRoot, projectName), "-p", projectName];
  const options = {
    cwd: repoRoot,
    env: composeEnv(repoRoot, projectName, hostPorts, desktopMode),
    encoding: "utf8" as const,
  };
  return {
    isContainerRunning: () => {
      const result = spawnSync("docker", [...args, "ps", "--status", "running", "--quiet", SERVICE], options);
      if (result.status !== 0) throw new Error(`docker compose ps failed: ${result.stderr.trim()}`);
      return result.stdout.trim().length > 0;
    },
    readContainerLogs: () => {
      const result = spawnSync("docker", [...args, "logs", "--no-color", "--tail", "200", SERVICE], options);
      return [result.stdout, result.stderr]
        .map((output) => output.trim())
        .filter(Boolean)
        .join("\n");
    },
  };
};

const STILL_WAITING_EVERY_MS = 30_000;
// Once the API answers, the container's own setup creates the demo project within seconds.
const PROJECT_AFTER_API_MS = 5 * 60_000;
const REJECTED_TOKEN_LIMIT = 30;
const DOCKER_FAILURE_LIMIT = 5;

type ProjectAnswer = { project?: { id: string; name: string }; status?: number };

/** One request for the demo project; a container that is still booting answers nothing. */
const askForProject = async (apiPort: number, token: string | undefined): Promise<ProjectAnswer> => {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/v1/projects`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { status: response.status };
    const projects = (await response.json()) as Array<{ id: string; name: string }>;
    return {
      status: response.status,
      project: projects.find((entry) => entry.name === SEEDED_PROJECT_NAME) ?? projects[0],
    };
  } catch {
    return {};
  }
};

// A cold start installs and validates every extension before the API answers, which can take
// several minutes, so the wait has no fixed limit while the container runs and the API has not
// answered. `token` is read on every attempt: the desktop runtime may replace a descriptor left
// by an earlier container.
const waitForSeededProject = async (
  apiPort: number,
  token: () => string | undefined,
  monitor: ReturnType<typeof createComposeServiceMonitor>,
) => {
  const started = Date.now();
  let lastNotice = started;
  let answeredAt: number | undefined;
  let rejected = 0;
  let dockerFailures = 0;
  const running = () => {
    try {
      const result = monitor.isContainerRunning();
      dockerFailures = 0;
      return result;
    } catch (error) {
      // A briefly busy Docker daemon must not end a start that is otherwise healthy.
      if (++dockerFailures >= DOCKER_FAILURE_LIMIT) throw error;
      return true;
    }
  };
  while (running()) {
    const { project, status } = await askForProject(apiPort, token());
    if (project) return project;
    rejected = status === 401 || status === 403 ? rejected + 1 : 0;
    if (rejected >= REJECTED_TOKEN_LIMIT)
      throw new Error(`The isolated API keeps rejecting its token (HTTP ${status}).`);
    if (status === 200) answeredAt ??= Date.now();
    if (answeredAt !== undefined && Date.now() - answeredAt > PROJECT_AFTER_API_MS)
      throw new Error(
        `The isolated API answered, but no project appeared within ${PROJECT_AFTER_API_MS / 60_000} minutes.\n${monitor.readContainerLogs()}`,
      );
    if (Date.now() - lastNotice >= STILL_WAITING_EVERY_MS) {
      lastNotice = Date.now();
      process.stdout.write(
        `Still starting after ${Math.round((lastNotice - started) / 1_000)} s; follow it with --logs.\n`,
      );
    }
    await Bun.sleep(1_000);
  }

  throw new Error(`The isolated container stopped before the demo project was ready.\n${monitor.readContainerLogs()}`);
};

const main = async () => {
  const args = process.argv.slice(2);

  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  resolveIsolatedUser();
  const repoRoot = resolve(import.meta.dir, "../..");
  const projectName = parseFlagValue(args, "--name") ?? `${PROJECT_PREFIX}-${randomBytes(2).toString("hex")}`;
  const desktopMode = hasFlag(args, "--desktop");
  const pstdioHome = resolveIsolatedHome(repoRoot, projectName);

  if (hasFlag(args, "--down")) {
    runCompose(projectName, repoRoot, ["down", "-v"]);
    rmSync(resolveStackDirectory(repoRoot, projectName), { recursive: true, force: true });
    return;
  }

  if (hasFlag(args, "--logs")) {
    runCompose(projectName, repoRoot, ["logs", "-f", SERVICE]);
    return;
  }

  const hostPorts = await reserveHostPorts();
  mkdirSync(pstdioHome, { recursive: true });
  const stackDirectory = resolveStackDirectory(repoRoot, projectName);
  const caCount = writeExtraCaContext(join(stackDirectory, "extra-ca"), process.env.NODE_EXTRA_CA_CERTS);
  if (caCount > 0) process.stdout.write(`Trusting ${caCount} certificate(s) from NODE_EXTRA_CA_CERTS in the image.\n`);
  const credentials = resolveCredentialMounts(
    process.env.HOME ?? process.env.USERPROFILE ?? "",
    process.env.PSTDIO_ISOLATED_AGENT_CREDENTIALS !== "0",
  );
  writeCredentialComposeFile(join(stackDirectory, CREDENTIALS_COMPOSE_FILE), credentials.mounted);
  for (const missing of credentials.missing)
    process.stdout.write(`Not mounted, file is missing: ${missing}. Sign that agent in on the host or in the stack.\n`);
  // The API listens on every container interface, so it needs a token. The desktop flow's runtime
  // creates its own; the Vite flow gets one per run, and the dashboard dev server holds it.
  const apiToken = desktopMode ? undefined : randomBytes(32).toString("base64url");
  runCompose(projectName, repoRoot, ["up", "-d", "--build"], hostPorts, desktopMode, apiToken);

  const containerPorts = resolveContainerPorts(hostPorts, desktopMode);
  const apiPort = lookupHostPort(projectName, repoRoot, containerPorts.api, hostPorts, desktopMode);
  const port = desktopMode
    ? apiPort
    : lookupHostPort(projectName, repoRoot, containerPorts.dashboard, hostPorts, desktopMode);
  const monitor = createComposeServiceMonitor(projectName, repoRoot, hostPorts, desktopMode);
  let token = desktopMode ? await waitForRuntimeDescriptor(pstdioHome, monitor) : apiToken;
  const project = await waitForSeededProject(
    apiPort,
    () => (token = desktopMode ? (readRuntimeToken(pstdioHome) ?? token) : apiToken),
    monitor,
  );
  const dashboardUrl = resolveIsolatedDashboardUrl(port);
  writeFileSync(
    resolve(pstdioHome, "..", "connection.json"),
    `${JSON.stringify({ apiPort, apiToken: token, dashboardUrl, pstdioHome }, null, 2)}\n`,
  );
  process.stdout.write(`\nStack:     ${projectName}\n`);
  process.stdout.write(`Dashboard: ${dashboardUrl}\n`);
  if (desktopMode) process.stdout.write(`Desktop home: ${pstdioHome}\n`);
  process.stdout.write(`Project:   ${dashboardUrl}projects/${project.id}/\n`);
  process.stdout.write(`Sessions:  ${dashboardUrl}projects/${project.id}/sessions\n`);
  process.stdout.write(`Logs:      bun run dev:isolated -- --name ${projectName} --logs\n`);
  process.stdout.write(`Stop:      bun run dev:isolated -- --name ${projectName} --down\n`);
  if (hasFlag(args, "--large")) {
    for (const project of await seedLargeProject(resolve(pstdioHome, "..", "connection.json")))
      process.stdout.write(
        `Large:     ${project.project}: ${project.tickets} tickets, ${project.workspaces} workspaces, ${project.sessions} sessions, ${project.links} links ${project.url}\n`,
      );
  }
};

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
