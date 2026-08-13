// Wraps `docker compose -f infra/local/compose.yaml` with the host paths the file
// requires (HOST_WORKTREE, HOST_GIT_COMMON_DIR), assigns a unique compose project
// name so multiple instances can run in parallel, and prints the dashboard URL once
// the stack is up.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

const COMPOSE_FILE = "infra/local/compose.yaml";
const PROJECT_PREFIX = "pstdio-cmp";
const SERVICE = "prompt-studio";
const CONTAINER_DASHBOARD_PORT = 5173;
const CONTAINER_API_PORT = 19841;
const SEEDED_PROJECT_NAME = "project";

const usage = `Usage:
  bun run dev:isolated                          # build + up; prints dashboard URL
  bun run dev:isolated -- --name <id>           # pin a stable compose project name
  bun run dev:isolated -- --down                # tear the stack down (incl. volumes)
  bun run dev:isolated -- --logs                # follow logs
  bun run dev:isolated -- --desktop             # unified runtime for Electron development

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

export const resolveIsolatedHome = (repoRoot: string, projectName: string) => {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(projectName)) {
    throw new Error(`Invalid isolated stack name: ${projectName}`);
  }
  return resolve(repoRoot, "__test-tmp__", "dev-isolated", projectName, "pstdio-home");
};

export const resolveIsolatedBrowserTransport = (hostPorts?: HostPorts) => ({
  PSTDIO_TERMINAL_ORIGINS: `http://localhost:${hostPorts?.dashboard ?? CONTAINER_DASHBOARD_PORT}`,
  PSTDIO_TERMINAL_WEBSOCKET_URL: `ws://localhost:${hostPorts?.api ?? CONTAINER_API_PORT}/v1/terminal`,
});

const composeEnv = (repoRoot: string, projectName: string, hostPorts?: HostPorts, desktopMode = false) => ({
  ...process.env,
  HOST_WORKTREE: repoRoot,
  HOST_GIT_COMMON_DIR: resolveGitCommonDir(repoRoot),
  HOST_PSTDIO_HOME: resolveIsolatedHome(repoRoot, projectName),
  PSTDIO_DESKTOP_FLOW: desktopMode ? "1" : "0",
  ...resolveIsolatedBrowserTransport(hostPorts),
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
) => {
  const result = spawnSync("docker", ["compose", "-f", COMPOSE_FILE, "-p", projectName, ...extraArgs], {
    cwd: repoRoot,
    env: composeEnv(repoRoot, projectName, hostPorts, desktopMode),
    stdio: "inherit",
  });
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
    ["compose", "-f", COMPOSE_FILE, "-p", projectName, "port", SERVICE, String(containerPort)],
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

const waitForRuntimeDescriptor = async (pstdioHome: string) => {
  const path = join(pstdioHome, "runtime.json");
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (existsSync(path)) {
      try {
        const descriptor = JSON.parse(readFileSync(path, "utf8")) as { token?: unknown };
        if (typeof descriptor.token === "string" && descriptor.token) return descriptor.token;
      } catch {
        // The runtime may still be replacing the descriptor atomically.
      }
    }
    await Bun.sleep(1_000);
  }
  throw new Error("Timed out waiting for the isolated desktop runtime descriptor.");
};

const waitForSeededProject = async (apiPort: number, token?: string) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/v1/projects`, {
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      if (response.ok) {
        const projects = (await response.json()) as Array<{ id: string; name: string }>;
        const project = projects.find((entry) => entry.name === SEEDED_PROJECT_NAME) ?? projects[0];
        if (project) return project;
      }
    } catch {
      // The container is still booting.
    }

    await Bun.sleep(1_000);
  }

  throw new Error("Timed out waiting for the isolated demo project.");
};

const main = async () => {
  const args = process.argv.slice(2);

  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    process.stdout.write(`${usage}\n`);
    return;
  }

  const repoRoot = resolve(import.meta.dir, "../..");
  const projectName = parseFlagValue(args, "--name") ?? `${PROJECT_PREFIX}-${randomBytes(2).toString("hex")}`;
  const desktopMode = hasFlag(args, "--desktop");
  const pstdioHome = resolveIsolatedHome(repoRoot, projectName);

  if (hasFlag(args, "--down")) {
    runCompose(projectName, repoRoot, ["down", "-v"]);
    rmSync(resolve(repoRoot, "__test-tmp__", "dev-isolated", projectName), { recursive: true, force: true });
    return;
  }

  if (hasFlag(args, "--logs")) {
    runCompose(projectName, repoRoot, ["logs", "-f", SERVICE]);
    return;
  }

  const hostPorts = await reserveHostPorts();
  mkdirSync(pstdioHome, { recursive: true });
  runCompose(projectName, repoRoot, ["up", "-d", "--build"], hostPorts, desktopMode);

  const containerPorts = resolveContainerPorts(hostPorts, desktopMode);
  const apiPort = lookupHostPort(projectName, repoRoot, containerPorts.api, hostPorts, desktopMode);
  const port = desktopMode
    ? apiPort
    : lookupHostPort(projectName, repoRoot, containerPorts.dashboard, hostPorts, desktopMode);
  const token = desktopMode ? await waitForRuntimeDescriptor(pstdioHome) : undefined;
  const project = await waitForSeededProject(apiPort, token);
  writeFileSync(
    resolve(pstdioHome, "..", "connection.json"),
    `${JSON.stringify({ apiPort, dashboardUrl: `http://127.0.0.1:${port}/`, pstdioHome }, null, 2)}\n`,
  );
  process.stdout.write(`\nStack:     ${projectName}\n`);
  process.stdout.write(`Dashboard: http://localhost:${port}/\n`);
  if (desktopMode) process.stdout.write(`Desktop home: ${pstdioHome}\n`);
  process.stdout.write(`Project:   http://localhost:${port}/projects/${project.id}/\n`);
  process.stdout.write(`Sessions:  http://localhost:${port}/projects/${project.id}/sessions\n`);
  process.stdout.write(`Logs:      bun run dev:isolated -- --name ${projectName} --logs\n`);
  process.stdout.write(`Stop:      bun run dev:isolated -- --name ${projectName} --down\n`);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
