import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sanitizeForwardedArgs = (argv: string[]) => argv.filter((arg) => arg !== "--silent");

export const createRunId = ({ now = Date.now(), pid = process.pid }: { now?: number; pid?: number } = {}) =>
  `${now}-${pid}`;

export const buildPlaywrightEnv = (
  env: NodeJS.ProcessEnv,
  ports: { apiPort: number; dashboardPort: number },
  runId: string,
) => {
  const cleanEnv = { ...env };

  for (const key of Object.keys(cleanEnv)) {
    if (key.startsWith("PSTDIO_")) delete cleanEnv[key];
  }

  return {
    ...cleanEnv,
    E2E_API_PORT: String(ports.apiPort),
    E2E_DASHBOARD_PORT: String(ports.dashboardPort),
    E2E_RUN_ID: runId,
  };
};

export const getPlaywrightCommand = (args: string[], priority = process.env.CI_PRIORITY ?? "P1") => {
  if (!["P0", "P1", "P2", "P3"].includes(priority)) throw new Error(`Unknown test priority: ${priority}`);
  const selected: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "-x") continue;
    if (args[index] === "--max-failures") {
      index++;
      continue;
    }
    if (args[index]?.startsWith("--max-failures=")) continue;
    selected.push(args[index]!);
  }
  return {
    cmd: process.execPath,
    args: ["x", "--no-install", "playwright", "test", ...selected, `--max-failures=${priority === "P1" ? 1 : 0}`],
  };
};

// A run owns one temporary folder for its server home and Bun cache. A per-run cache keeps an
// interrupted run's partial package extraction away from later runs; removing the folder when
// Playwright exits keeps finished runs from filling the disk. Paths a caller provides stay theirs.
export const runPlaywright = async (
  command: { cmd: string; args: string[] },
  env: NodeJS.ProcessEnv,
  options: { stdio: "inherit" | "pipe" } = { stdio: "inherit" },
) => {
  const runFolder = mkdtempSync(join(tmpdir(), "pstdio-e2e-run-"));
  const child = spawn(command.cmd, command.args, {
    env: {
      ...env,
      E2E_HOME: env.E2E_HOME ?? join(runFolder, "home"),
      E2E_BUN_CACHE_DIR: env.E2E_BUN_CACHE_DIR ?? join(runFolder, "bun-cache"),
    },
    stdio: options.stdio,
  });
  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk;
  });
  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });
    return { exitCode, output };
  } finally {
    rmSync(runFolder, { recursive: true, force: true });
  }
};

const forwardedArgs = sanitizeForwardedArgs(process.argv.slice(2));

const getFreePort = async () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to resolve free port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const getPortPair = async () => {
  const apiPort = await getFreePort();
  let dashboardPort = await getFreePort();

  while (dashboardPort === apiPort) {
    dashboardPort = await getFreePort();
  }

  return { apiPort, dashboardPort };
};

const run = async () => {
  const { apiPort, dashboardPort } = await getPortPair();
  const runId = process.env.E2E_RUN_ID ?? createRunId();
  const command = getPlaywrightCommand(forwardedArgs);

  const { exitCode } = await runPlaywright(command, buildPlaywrightEnv(process.env, { apiPort, dashboardPort }, runId));
  process.exit(exitCode);
};

if (import.meta.main) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
